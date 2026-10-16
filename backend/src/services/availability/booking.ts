import { Prisma, AppointmentStatus, BookingSource } from '@prisma/client';
import { runInTransaction } from '../../lib/db';
import { getTenantTimezone } from '../../lib/tenantInfo';
import { instantToLocal } from '../../lib/time';
import { computeSlots, Slot } from './engine';
import { AvailabilityError } from './errors';
import { appointmentInclude, toAppointmentDto } from './dto';
import { assertPlanAllows } from '../planLimits';
import { scheduleBookingJobs, scheduleCancelledJob } from '../notifications/lifecycle';
import { randomBytes } from 'node:crypto';

/**
 * Crear, reprogramar y cancelar citas. Cada operación recalcula la
 * disponibilidad dentro de su transacción, tras tomar un candado de aviso por
 * salón y día (así las reservas de un mismo día se ordenan y el tope diario no
 * se sobrepasa); la restricción EXCLUDE de la base es la red de seguridad final.
 *
 * No se usa aislamiento SERIALIZABLE: con tablas pequeñas Postgres toma candados
 * de predicado a nivel de tabla y abortaría reservas de salones distintos.
 */

/** Secreto del enlace "gestionar mi cita" (256 bits, URL-safe). */
export const newCancelToken = () => randomBytes(32).toString('base64url');

/** Serializa las reservas de un mismo salón y día. Los candados se piden ordenados para evitar interbloqueos. */
async function lockDays(tx: Prisma.TransactionClient, tenantId: string, dates: string[]) {
  for (const dateStr of [...new Set(dates)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}), hashtext(${dateStr}))`;
  }
}

export interface CreateBookingParams {
  tenantId: string;
  serviceId: string;
  clientId: string;
  dateStr: string; // YYYY-MM-DD en la zona del salón
  startTime: string; // HH:mm
  professionalId?: string | 'any' | null;
  notes?: string;
  status?: AppointmentStatus;
  source?: BookingSource;
  forPublic?: boolean;
  /** Aplicar antelación mínima/máxima (clientes). El panel de administración no. */
  enforceWindow?: boolean;
}

function findSlot(slots: Slot[], startTime: string, professionalId: string | 'any' | null | undefined) {
  const slot = slots.find((s) => s.startTime === startTime);
  if (!slot) return null;
  const wanted = professionalId && professionalId !== 'any' ? professionalId : null;
  if (wanted && !slot.professionalIds.includes(wanted)) return null;
  return { slot, professionalId: wanted ?? slot.professionalIds[0] };
}

export async function createBooking(params: CreateBookingParams) {
  const { tenantId, serviceId, clientId, dateStr, startTime } = params;

  await assertPlanAllows(tenantId, 'appointment');

  const appointment = await runInTransaction(async (tx) => {
    await lockDays(tx, tenantId, [dateStr]);
    const client = await tx.client.findFirst({ where: { id: clientId, tenantId }, select: { id: true } });
    if (!client) throw new AvailabilityError('Cliente no válido');

    const { slots, reason, service } = await computeSlots(tx, {
      tenantId,
      dateStr,
      serviceId,
      professionalId: params.professionalId,
      forPublic: params.forPublic,
      enforceWindow: params.enforceWindow,
    });

    const match = findSlot(slots, startTime, params.professionalId);
    if (!match) {
      throw new AvailabilityError(
        slots.length === 0 && reason ? reason : 'El horario seleccionado ya no está disponible. Elige otro.',
        409
      );
    }
    const { slot, professionalId } = match;

    return tx.appointment.create({
      data: {
        tenantId,
        clientId,
        serviceId,
        professionalId,
        resourceId: slot.resourceId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        blockStartsAt: slot.blockStartsAt,
        blockEndsAt: slot.blockEndsAt,
        serviceName: service.name,
        priceAmount: service.price,
        currency: service.currency,
        durationMin: service.durationMinutes,
        bufferBeforeMin: service.bufferBeforeMin,
        bufferAfterMin: service.bufferAfterMin,
        status: params.status ?? 'SCHEDULED',
        source: params.source ?? 'ADMIN',
        cancelToken: newCancelToken(),
        notes: params.notes,
      },
      include: appointmentInclude,
    });
  });

  await scheduleBookingJobs(appointment, { announce: true });
  return toAppointmentDto(appointment, await getTenantTimezone(tenantId));
}

export interface UpdateBookingParams {
  tenantId: string;
  id: string;
  dateStr?: string;
  startTime?: string;
  serviceId?: string;
  /** string = ese profesional, 'any' = cualquiera libre, null = sin cambios. */
  professionalId?: string | 'any' | null;
  clientId?: string;
  status?: AppointmentStatus;
  notes?: string | null;
  enforceWindow?: boolean;
}

export async function updateBooking(params: UpdateBookingParams) {
  const { tenantId, id } = params;
  const timezone = await getTenantTimezone(tenantId);

  const updated = await runInTransaction(async (tx) => {
    const preview = await tx.appointment.findFirst({ where: { id, tenantId }, select: { startsAt: true } });
    if (!preview) throw new AvailabilityError('Cita no encontrada', 404);
    await lockDays(tx, tenantId, [instantToLocal(timezone, preview.startsAt).dateStr, ...(params.dateStr ? [params.dateStr] : [])]);

    const existing = await tx.appointment.findFirst({ where: { id, tenantId } });
    if (!existing) throw new AvailabilityError('Cita no encontrada', 404);

    const data: Prisma.AppointmentUncheckedUpdateInput = {};
    if (params.notes !== undefined) data.notes = params.notes;
    if (params.clientId && params.clientId !== existing.clientId) {
      const client = await tx.client.findFirst({ where: { id: params.clientId, tenantId }, select: { id: true } });
      if (!client) throw new AvailabilityError('Cliente no válido');
      data.clientId = params.clientId;
    }

    const resultingStatus = params.status ?? existing.status;
    const wasActive = existing.status === 'SCHEDULED' || existing.status === 'PENDING';
    const willBeActive = resultingStatus === 'SCHEDULED' || resultingStatus === 'PENDING';
    if (params.status && params.status !== existing.status) {
      data.status = params.status;
      if (params.status === 'CANCELLED') {
        data.cancelledAt = new Date();
        data.cancelledBy = 'STAFF';
      } else if (existing.status === 'CANCELLED') {
        data.cancelledAt = null;
        data.cancelledBy = null;
      }
    }

    const local = instantToLocal(timezone, existing.startsAt);
    const moved =
      (params.dateStr !== undefined && params.dateStr !== local.dateStr) ||
      (params.startTime !== undefined && params.startTime !== local.time) ||
      (params.serviceId !== undefined && params.serviceId !== existing.serviceId) ||
      (params.professionalId !== undefined && params.professionalId !== null && params.professionalId !== existing.professionalId);
    const reactivated = willBeActive && !wasActive;

    // Cancelar o completar nunca se bloquea por reglas de disponibilidad.
    if ((moved || reactivated) && willBeActive) {
      const dateStr = params.dateStr ?? local.dateStr;
      const startTime = params.startTime ?? local.time;
      const serviceId = params.serviceId ?? existing.serviceId;
      const wantedProfessional =
        params.professionalId === undefined || params.professionalId === null ? existing.professionalId : params.professionalId;

      const { slots, service, reason } = await computeSlots(tx, {
        tenantId,
        dateStr,
        serviceId,
        professionalId: wantedProfessional,
        enforceWindow: params.enforceWindow,
        excludeAppointmentId: id,
      });
      const match = findSlot(slots, startTime, wantedProfessional);
      if (!match) {
        throw new AvailabilityError(
          slots.length === 0 && reason ? reason : 'El horario seleccionado no está disponible. Elige otro.',
          409
        );
      }
      const { slot, professionalId } = match;

      Object.assign(data, {
        professionalId,
        resourceId: slot.resourceId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        blockStartsAt: slot.blockStartsAt,
        blockEndsAt: slot.blockEndsAt,
      });
      if (serviceId !== existing.serviceId) {
        Object.assign(data, {
          serviceId,
          serviceName: service.name,
          priceAmount: service.price,
          currency: service.currency,
          durationMin: service.durationMinutes,
          bufferBeforeMin: service.bufferBeforeMin,
          bufferAfterMin: service.bufferAfterMin,
        });
      }
    }

    const result = await tx.appointment.update({ where: { id }, data, include: appointmentInclude });
    return { result, rescheduled: 'startsAt' in data, cancelledNow: data.status === 'CANCELLED' && wasActive };
  });

  if (updated.cancelledNow) await scheduleCancelledJob(updated.result, 'STAFF');
  else if (updated.rescheduled) await scheduleBookingJobs(updated.result, { announce: true });
  return toAppointmentDto(updated.result, timezone);
}

export async function cancelBooking(params: { tenantId: string; id: string; by: 'CUSTOMER' | 'STAFF' | 'SYSTEM' }) {
  const timezone = await getTenantTimezone(params.tenantId);
  const cancelled = await runInTransaction(async (tx) => {
    const existing = await tx.appointment.findFirst({ where: { id: params.id, tenantId: params.tenantId } });
    if (!existing) throw new AvailabilityError('Cita no encontrada', 404);
    return tx.appointment.update({
      where: { id: params.id },
      data: { status: 'CANCELLED', cancelledBy: params.by, cancelledAt: new Date() },
      include: appointmentInclude,
    });
  });
  await scheduleCancelledJob(cancelled, params.by);
  return toAppointmentDto(cancelled, timezone);
}
