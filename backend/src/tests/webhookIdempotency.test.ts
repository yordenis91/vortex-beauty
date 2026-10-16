import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { Pool } from 'pg';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

// Mercado Pago se simula: el webhook solo avisa y el detalle se pide a su API.
vi.mock('../services/mercadoPagoService', () => ({
  getPayment: vi.fn(async (id: string) => ({
    id,
    status: 'approved',
    transaction_amount: 49,
    currency_id: 'USD',
    date_approved: new Date().toISOString(),
    external_reference: (globalThis as { __tenantId?: string }).__tenantId,
  })),
  getPreApproval: vi.fn(),
  isMercadoPagoConfigured: () => true,
  validateWebhookSignature: () => undefined,
  InvalidWebhookSignatureError: class extends Error {},
  createCheckout: vi.fn(),
}));

const describeIfDb = dbTestsEnabled ? describe : describe.skip;

describeIfDb('webhook de Mercado Pago: idempotencia', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let tenantId: string;
  let planId: string;

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    await ctx.runAsAdmin(async () => {
      const tenant = await prisma.tenant.create({ data: { name: 'Salón MP', slug: `mp-${Date.now().toString(36)}` } });
      tenantId = tenant.id;
      (globalThis as { __tenantId?: string }).__tenantId = tenantId;
      const plan = await prisma.plan.create({ data: { name: 'MP', slug: `mp-${tenantId}`, priceMonthly: 49, priceYearly: 490 } });
      planId = plan.id;
      await prisma.tenantSubscription.create({ data: { tenantId, planId, status: 'PAST_DUE', currentPeriodEnd: new Date('2099-01-01') } });
    });
  });

  afterAll(async () => {
    await ctx.runAsAdmin(async () => {
      await prisma.tenant.delete({ where: { id: tenantId } });
      await prisma.plan.delete({ where: { id: planId } });
    });
    await adminPool.end();
  });

  it('procesar dos veces la misma notificación de pago no duplica la factura y deja la suscripción activa', async () => {
    const { reconcilePayment } = await import('../services/billingReconciliation');
    await reconcilePayment('pay-123');
    await reconcilePayment('pay-123'); // reintento del webhook

    const invoices = await ctx.runAsAdmin(() => prisma.platformInvoice.findMany({ where: { tenantId } }));
    expect(invoices).toHaveLength(1);
    expect(invoices[0].invoiceNumber).toBe('PLAT-MP-pay-123');
    expect(invoices[0].status).toBe('PAID');

    const subscription = await ctx.runAsAdmin(() => prisma.tenantSubscription.findUniqueOrThrow({ where: { tenantId } }));
    expect(subscription.status).toBe('ACTIVE');
  });
});
