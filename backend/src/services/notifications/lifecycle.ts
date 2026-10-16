import prisma from '../../prismaClient';
import { enqueue, QUEUES } from '../../lib/queue';
import { runWithTenant } from '../../lib/tenantContext';

/**
 * Qué se encola cuando cambia una cita. Se llama desde services/availability/booking.ts
 * después de confirmar la transacción; un fallo al encolar nunca debe romper la reserva.
 */
const HOUR = 3600 * 1000;

async function reminderHours(tenantId: string): Promise<number[]> {
  const settings = await runWithTenant(tenantId, () => prisma.tenantSettings.findUnique({ where: { tenantId }, select: { reminderHours: true } }));
  return settings?.reminderHours ?? [24, 2];
}

export async function scheduleBookingJobs(appointment: { id: string; tenantId: string; startsAt: Date }, options: { announce: boolean }): Promise<void> {
  try {
    const { id, tenantId, startsAt } = appointment;
    if (options.announce) {
      await enqueue(QUEUES.confirmed, { tenantId, appointmentId: id }, { singletonKey: `confirmed:${id}:${startsAt.getTime()}` });
    }
    const now = Date.now();
    for (const hours of await reminderHours(tenantId)) {
      const when = startsAt.getTime() - hours * HOUR;
      // Un recordatorio cuya hora ya pasó (reserva de última hora) no se envía.
      if (when <= now + 60_000) continue;
      await enqueue(
        QUEUES.reminder,
        { tenantId, appointmentId: id, hoursBefore: hours, startsAt: startsAt.getTime() },
        { startAfter: new Date(when), singletonKey: `reminder:${id}:${startsAt.getTime()}:${hours}` }
      );
    }
  } catch (error) {
    console.error('[queue] no se pudieron encolar los avisos de la cita:', error);
  }
}

export async function scheduleCancelledJob(appointment: { id: string; tenantId: string }, by: 'CUSTOMER' | 'STAFF' | 'SYSTEM'): Promise<void> {
  try {
    await enqueue(QUEUES.cancelled, { tenantId: appointment.tenantId, appointmentId: appointment.id, by });
  } catch (error) {
    console.error('[queue] no se pudo encolar el aviso de cancelación:', error);
  }
}
