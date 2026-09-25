import {
  MercadoPagoConfig,
  PreApproval,
  PreApprovalPlan,
  Payment,
  WebhookSignatureValidator,
  InvalidWebhookSignatureError,
} from 'mercadopago';
import type { Request } from 'express';
import prisma from '../prismaClient';
import type { Plan, BillingCycle } from '@prisma/client';

/**
 * Todo lo relativo a Mercado Pago vive acá. El resto de la app nunca importa
 * el SDK directamente — solo conoce estas funciones, para poder testear/leer
 * la lógica de negocio sin acoplarse a la forma exacta de la API externa.
 */

export function isMercadoPagoConfigured(): boolean {
  return !!process.env.MERCADOPAGO_ACCESS_TOKEN;
}

let clientSingleton: MercadoPagoConfig | null = null;

function getClient(): MercadoPagoConfig {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN no está configurado');
  }
  if (!clientSingleton) {
    clientSingleton = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
      options: { timeout: 8000 },
    });
  }
  return clientSingleton;
}

function frontendUrl(): string {
  return process.env.FRONTEND_PUBLIC_URL || 'https://deploy-vortex-frontend.wgteoi.easypanel.host';
}

/**
 * Frecuencia de cobro que espera Mercado Pago para cada ciclo. Su API solo
 * entiende "days" o "months" (no "years"), así que anual es 12 meses.
 */
function autoRecurringFor(plan: Plan, billingCycle: BillingCycle) {
  if (billingCycle === 'YEARLY') {
    return { frequency: 12, frequency_type: 'months', transaction_amount: Number(plan.priceYearly), currency_id: process.env.MERCADOPAGO_CURRENCY || 'ARS' };
  }
  return { frequency: 1, frequency_type: 'months', transaction_amount: Number(plan.priceMonthly), currency_id: process.env.MERCADOPAGO_CURRENCY || 'ARS' };
}

/**
 * Devuelve el id del "preapproval_plan" (plantilla de suscripción) de
 * Mercado Pago para este Plan + ciclo de cobro, creándolo la primera vez que
 * hace falta y cacheándolo en el propio Plan para no duplicarlo después.
 */
async function ensurePreApprovalPlanId(plan: Plan, billingCycle: BillingCycle): Promise<string> {
  const cached = billingCycle === 'YEARLY' ? plan.mpPlanIdYearly : plan.mpPlanIdMonthly;
  if (cached) return cached;

  const preApprovalPlan = new PreApprovalPlan(getClient());
  const response = await preApprovalPlan.create({
    body: {
      reason: `${plan.name} (${billingCycle === 'YEARLY' ? 'anual' : 'mensual'})`,
      auto_recurring: autoRecurringFor(plan, billingCycle),
      back_url: `${frontendUrl()}/admin/billing`,
    },
  });

  if (!response.id) {
    throw new Error('Mercado Pago no devolvió un id de plan');
  }

  await prisma.plan.update({
    where: { id: plan.id },
    data: billingCycle === 'YEARLY' ? { mpPlanIdYearly: response.id } : { mpPlanIdMonthly: response.id },
  });

  return response.id;
}

interface CreateCheckoutParams {
  tenantId: string;
  plan: Plan;
  billingCycle: BillingCycle;
  payerEmail: string;
}

/**
 * Crea la suscripción (preapproval) en Mercado Pago y devuelve la URL a la
 * que hay que mandar al admin del salón para que autorice el cobro
 * recurrente. Mercado Pago captura la tarjeta en su propio checkout
 * hospedado — esta app nunca ve ni almacena datos de tarjeta.
 */
export async function createCheckout({ tenantId, plan, billingCycle, payerEmail }: CreateCheckoutParams) {
  const preapprovalPlanId = await ensurePreApprovalPlanId(plan, billingCycle);

  const preApproval = new PreApproval(getClient());
  const response = await preApproval.create({
    body: {
      preapproval_plan_id: preapprovalPlanId,
      reason: plan.name,
      payer_email: payerEmail,
      external_reference: tenantId,
      back_url: `${frontendUrl()}/admin/billing`,
      status: 'pending',
    },
  });

  if (!response.id || !response.init_point) {
    throw new Error('Mercado Pago no devolvió una URL de autorización');
  }

  return { preapprovalId: response.id, redirectUrl: response.init_point };
}

export async function getPreApproval(id: string) {
  return new PreApproval(getClient()).get({ id });
}

export async function getPayment(id: string) {
  return new Payment(getClient()).get({ id });
}

/**
 * Valida que un webhook entrante venga realmente de Mercado Pago, usando el
 * validador oficial del SDK (compara en tiempo constante, no a mano). Lanza
 * InvalidWebhookSignatureError si no valida.
 */
export function validateWebhookSignature(req: Request): void {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('MERCADOPAGO_WEBHOOK_SECRET no está configurado');
  }

  WebhookSignatureValidator.validate({
    xSignature: req.headers['x-signature'] as string | undefined,
    xRequestId: req.headers['x-request-id'] as string | undefined,
    dataId: (req.query['data.id'] as string | undefined) ?? req.body?.data?.id,
    secret,
    toleranceSeconds: 300,
  });
}

export { InvalidWebhookSignatureError };
