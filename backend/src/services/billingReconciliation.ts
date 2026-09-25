import prisma from '../prismaClient';
import { getPreApproval, getPayment } from './mercadoPagoService';
import type { TenantSubscriptionStatus } from '@prisma/client';

/** Traduce el estado de un preapproval de Mercado Pago a nuestro enum. `null` = evento reconocido pero sin cambio de estado que aplicar. */
function mapPreapprovalStatus(mpStatus: string | undefined): TenantSubscriptionStatus | null {
  switch (mpStatus) {
    case 'authorized':
      return 'ACTIVE';
    case 'paused':
      return 'PAST_DUE';
    case 'cancelled':
      return 'CANCELED';
    default:
      return null;
  }
}

/**
 * Se dispara con el topic `subscription_preapproval` del webhook. Trae el
 * preapproval completo desde Mercado Pago (nunca confiamos en el payload del
 * webhook en sí, solo lo usamos como aviso de "andá a mirar esto") y
 * actualiza la suscripción del salón correspondiente.
 */
export async function reconcilePreapproval(preapprovalId: string): Promise<void> {
  const preapproval = await getPreApproval(preapprovalId);

  const subscription = await prisma.tenantSubscription.findFirst({
    where: { externalSubscriptionId: preapprovalId },
  });

  if (!subscription) {
    // Probablemente un preapproval de otra integración/ambiente que comparte
    // el mismo access token, o el checkout todavía no terminó de asociarse.
    console.warn(`No se encontró TenantSubscription para el preapproval ${preapprovalId}`);
    return;
  }

  const status = mapPreapprovalStatus(preapproval.status);
  if (!status) return;

  await prisma.tenantSubscription.update({
    where: { id: subscription.id },
    data: {
      status,
      gateway: 'mercadopago',
      ...(preapproval.next_payment_date ? { currentPeriodEnd: new Date(preapproval.next_payment_date) } : {}),
      ...(status === 'CANCELED' ? { canceledAt: new Date() } : {}),
    },
  });
}

/**
 * Se dispara con el topic `payment`. Solo nos importan los pagos que vienen
 * de una suscripción nuestra: los identificamos por `external_reference`,
 * que seteamos al tenantId cuando se creó el preapproval en createCheckout().
 */
export async function reconcilePayment(paymentId: string): Promise<void> {
  const payment = await getPayment(paymentId);

  if (!payment.external_reference) return; // no es un pago nuestro (o falta el dato)

  const subscription = await prisma.tenantSubscription.findUnique({
    where: { tenantId: payment.external_reference },
    include: { plan: true },
  });

  if (!subscription) {
    console.warn(`No se encontró TenantSubscription para tenantId ${payment.external_reference} (payment ${paymentId})`);
    return;
  }

  const invoiceNumber = `PLAT-MP-${paymentId}`;
  const status = payment.status === 'approved' ? 'PAID' : payment.status === 'rejected' ? 'FAILED' : 'PENDING';

  try {
    await prisma.platformInvoice.upsert({
      where: { invoiceNumber },
      update: {
        status,
        paidAt: status === 'PAID' ? new Date(payment.date_approved || Date.now()) : undefined,
      },
      create: {
        invoiceNumber,
        tenantId: subscription.tenantId,
        tenantSubscriptionId: subscription.id,
        amount: payment.transaction_amount ?? 0,
        currency: payment.currency_id ?? subscription.plan?.currency ?? 'USD',
        status,
        issueDate: new Date(),
        dueDate: new Date(),
        paidAt: status === 'PAID' ? new Date(payment.date_approved || Date.now()) : null,
        gateway: 'mercadopago',
        externalPaymentId: String(paymentId),
      },
    });
  } catch (error) {
    console.error(`Error registrando PlatformInvoice para payment ${paymentId}:`, error);
  }

  // Un pago aprobado de una suscripción activa/pausada la confirma como al día.
  if (status === 'PAID' && subscription.status !== 'ACTIVE') {
    await prisma.tenantSubscription.update({ where: { id: subscription.id }, data: { status: 'ACTIVE' } });
  }
}
