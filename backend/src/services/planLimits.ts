import { basePrisma } from '../prismaClient';
import prisma from '../prismaClient';

export class PlanLimitError extends Error {
  name = 'PlanLimitError';
}

/**
 * Límites del plan del salón (Plan.maxStaff, Plan.maxAppointmentsPerMonth).
 * `null` en el plan significa ilimitado. Un salón sin suscripción de
 * plataforma no tiene límites (p. ej. en desarrollo).
 */
export async function assertPlanAllows(tenantId: string, kind: 'professional' | 'appointment'): Promise<void> {
  const subscription = await basePrisma.tenantSubscription.findUnique({
    where: { tenantId },
    include: { plan: { select: { name: true, maxStaff: true, maxAppointmentsPerMonth: true } } },
  });
  if (!subscription) return;

  if (subscription.status === 'EXPIRED' || subscription.status === 'CANCELED') {
    throw new PlanLimitError('La suscripción de este salón no está activa. Renueva tu plan para continuar.');
  }

  const { plan } = subscription;
  if (kind === 'professional' && plan.maxStaff != null) {
    const active = await prisma.professional.count({ where: { tenantId, isActive: true } });
    if (active >= plan.maxStaff) {
      throw new PlanLimitError(`Tu plan ${plan.name} permite hasta ${plan.maxStaff} profesionales. Mejora tu plan para añadir más.`);
    }
  }

  if (kind === 'appointment' && plan.maxAppointmentsPerMonth != null) {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const count = await prisma.appointment.count({ where: { tenantId, createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } } });
    if (count >= plan.maxAppointmentsPerMonth) {
      throw new PlanLimitError(`Tu plan ${plan.name} permite hasta ${plan.maxAppointmentsPerMonth} citas al mes. Mejora tu plan para recibir más.`);
    }
  }
}
