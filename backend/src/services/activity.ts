import type { AppointmentEventKind, BookingSource, CancelledBy } from '@prisma/client';
import prisma from '../prismaClient';
import { runAsAdmin, runWithTenant } from '../lib/tenantContext';

/**
 * Novedades de reservas para la campanita del panel (nueva, cambio, cancelación).
 * Se registran al terminar la operación, igual que los avisos: un fallo aquí
 * nunca debe romper la reserva.
 */

/** Días que se conservan las novedades. */
export const EVENT_RETENTION_DAYS = 60;

interface EventAppointment {
  id: string;
  tenantId: string;
  professionalId: string | null;
  source: BookingSource;
  serviceName: string;
  startsAt: Date;
  client: { name: string };
  professional?: { name: string } | null;
}

export async function recordAppointmentEvent(
  appointment: EventAppointment,
  event: { kind: AppointmentEventKind; actor: CancelledBy; actorUserId?: string; previousStartsAt?: Date }
): Promise<void> {
  try {
    await runWithTenant(appointment.tenantId, () =>
      prisma.appointmentEvent.create({
        data: {
          tenantId: appointment.tenantId,
          kind: event.kind,
          appointmentId: appointment.id,
          professionalId: appointment.professionalId,
          actor: event.actor,
          actorUserId: event.actorUserId ?? null,
          source: appointment.source,
          clientName: appointment.client.name,
          serviceName: appointment.serviceName,
          professionalName: appointment.professional?.name ?? null,
          startsAt: appointment.startsAt,
          previousStartsAt: event.previousStartsAt ?? null,
        },
      })
    );
  } catch (error) {
    console.error('[activity] no se pudo registrar la novedad de la cita:', error);
  }
}

/** Borra las novedades antiguas de todos los salones. Devuelve cuántas borró. */
export async function pruneOldEvents(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - EVENT_RETENTION_DAYS * 24 * 3600 * 1000);
  const result = await runAsAdmin(() => prisma.appointmentEvent.deleteMany({ where: { createdAt: { lt: cutoff } } }));
  return result.count;
}
