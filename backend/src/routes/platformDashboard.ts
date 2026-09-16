import express from 'express';
import prisma from '../prismaClient';
import { authenticatePlatformAdmin } from '../middleware/platformAuth';

const router = express.Router();

router.use(authenticatePlatformAdmin);

/** Precio mensual equivalente de una suscripción, según su ciclo de facturación. */
function monthlyEquivalent(plan: { priceMonthly: any; priceYearly: any }, billingCycle: string): number {
  if (billingCycle === 'YEARLY') {
    return Number(plan.priceYearly) / 12;
  }
  return Number(plan.priceMonthly);
}

// GET /api/platform/dashboard/metrics
router.get('/metrics', async (_req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalTenants, activeTenants, suspendedTenants, trialTenants, newTenantsThisMonth, activeSubscriptions, canceledThisMonth] =
      await Promise.all([
        prisma.tenant.count(),
        prisma.tenant.count({ where: { status: 'ACTIVE' } }),
        prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
        prisma.tenant.count({ where: { status: 'TRIAL' } }),
        prisma.tenant.count({ where: { createdAt: { gte: startOfMonth } } }),
        prisma.tenantSubscription.findMany({
          where: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
          include: { plan: true },
        }),
        prisma.tenantSubscription.count({ where: { canceledAt: { gte: startOfMonth, lte: now } } }),
      ]);

    const mrr = activeSubscriptions.reduce((sum, sub) => sum + monthlyEquivalent(sub.plan, sub.billingCycle), 0);
    const arr = mrr * 12;

    // Simplificación MVP: no tenemos snapshots históricos del tamaño de la
    // base activa, así que se aproxima con el número de suscripciones
    // activas hoy más las canceladas este mes (denominador "activos al
    // inicio del mes" estimado). Suficiente para una primera señal de churn,
    // no para reportes financieros exactos.
    const estimatedActiveAtStartOfMonth = activeSubscriptions.length + canceledThisMonth;
    const churnRate = estimatedActiveAtStartOfMonth > 0 ? canceledThisMonth / estimatedActiveAtStartOfMonth : 0;

    res.json({
      totalTenants,
      activeTenants,
      suspendedTenants,
      trialTenants,
      newTenantsThisMonth,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      churnRate: Math.round(churnRate * 10000) / 10000,
      activeSubscriptionsCount: activeSubscriptions.length,
    });
  } catch (error) {
    console.error('Error calculando métricas del dashboard:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/platform/dashboard/growth — nuevos tenants por mes (últimos 6 meses)
router.get('/growth', async (_req, res) => {
  try {
    const now = new Date();
    const monthsBack = 6;
    const since = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);

    const tenants = await prisma.tenant.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const buckets: { month: string; count: number }[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, count: 0 });
    }

    tenants.forEach((t) => {
      const key = `${t.createdAt.getFullYear()}-${String(t.createdAt.getMonth() + 1).padStart(2, '0')}`;
      const bucket = buckets.find((b) => b.month === key);
      if (bucket) bucket.count += 1;
    });

    res.json(buckets);
  } catch (error) {
    console.error('Error calculando crecimiento:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/platform/dashboard/revenue-by-plan
router.get('/revenue-by-plan', async (_req, res) => {
  try {
    const subscriptions = await prisma.tenantSubscription.findMany({
      where: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
      include: { plan: true },
    });

    const byPlan = new Map<string, { planId: string; planName: string; mrr: number; tenantCount: number }>();
    subscriptions.forEach((sub) => {
      const entry = byPlan.get(sub.planId) ?? { planId: sub.planId, planName: sub.plan.name, mrr: 0, tenantCount: 0 };
      entry.mrr += monthlyEquivalent(sub.plan, sub.billingCycle);
      entry.tenantCount += 1;
      byPlan.set(sub.planId, entry);
    });

    const result = Array.from(byPlan.values())
      .map((entry) => ({ ...entry, mrr: Math.round(entry.mrr * 100) / 100 }))
      .sort((a, b) => b.mrr - a.mrr);

    res.json(result);
  } catch (error) {
    console.error('Error calculando ingresos por plan:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
