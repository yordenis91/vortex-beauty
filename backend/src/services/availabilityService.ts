import { Prisma, AppointmentStatus } from '@prisma/client';
import prisma from '../prismaClient';

/**
 * Regla única de disponibilidad de la agenda, usada por el portal de clientas
 * y por la administración. Antes vivía por triplicado y ya había divergido:
 * el portal comprobaba el cupo máximo diario y el solapamiento por rango de
 * minutos; la administración no comprobaba ninguna de las dos.
 */
export class AvailabilityError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Día de la semana (0 = domingo ... 6 = sábado) a partir de una fecha de
 * calendario "YYYY-MM-DD". Se interpreta siempre como fecha de calendario,
 * no como instante, para que el resultado no dependa del huso horario del
 * servidor (antes unos endpoints usaban getDay() y otros getUTCDay(), y
 * podían dar días distintos para la misma fecha).
 */
export function dayOfWeekFromDateString(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

export function dayRangeUTC(dateStr: string): { start: Date; end: Date } {
  return {
    start: new Date(`${dateStr}T00:00:00.000Z`),
    end: new Date(`${dateStr}T23:59:59.999Z`),
  };
}

interface SlotParams {
  dateStr: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  /** Al reprogramar una cita existente, excluirla de las comprobaciones de cupo/solape. */
  excludeAppointmentId?: string;
}

/**
 * Lanza AvailabilityError si el hueco solicitado no se puede reservar.
 * Debe ejecutarse dentro de la misma transacción que la creación/actualización
 * de la cita (ver createAppointmentSafely / updateAppointmentSafely) para que
 * la comprobación y la escritura sean atómicas.
 */
export async function assertSlotAvailable(
  tx: Prisma.TransactionClient,
  { dateStr, startTime, endTime, excludeAppointmentId }: SlotParams
): Promise<void> {
  const closedDate = await tx.closedDate.findUnique({ where: { date: dateStr } });
  if (closedDate) {
    throw new AvailabilityError('El salón está cerrado ese día');
  }

  const dayOfWeek = dayOfWeekFromDateString(dateStr);
  const [scheduleOverride, businessHour] = await Promise.all([
    tx.scheduleOverride.findUnique({ where: { date: dateStr } }),
    tx.businessHour.findUnique({ where: { dayOfWeek } }),
  ]);

  // Un override para la fecha es la fuente de verdad: su sola presencia abre
  // el día aunque el horario comercial habitual de ese día de la semana esté
  // cerrado (así el admin puede abrir un domingo puntual, por ejemplo).
  if (!scheduleOverride && (!businessHour || !businessHour.isOpen)) {
    throw new AvailabilityError('El salón está cerrado en este horario');
  }

  const explicitSlots = scheduleOverride ? scheduleOverride.timeSlots : businessHour?.timeSlots;

  if (Array.isArray(explicitSlots) && explicitSlots.length > 0) {
    if (!explicitSlots.includes(startTime)) {
      throw new AvailabilityError('El horario seleccionado no está permitido para este día');
    }
  } else if (businessHour) {
    // Compatibilidad retro: sin timeSlots explícitos, se valida contra el rango general del día.
    const reqStart = timeToMinutes(startTime);
    const reqEnd = timeToMinutes(endTime);
    const shopStart = timeToMinutes(businessHour.startTime);
    const shopEnd = timeToMinutes(businessHour.endTime);

    if (reqStart < shopStart || reqEnd > shopEnd) {
      throw new AvailabilityError('El salón está cerrado en este horario');
    }
  }

  const { start: startOfDay, end: endOfDay } = dayRangeUTC(dateStr);

  const otherScheduled = await tx.appointment.findMany({
    where: {
      date: { gte: startOfDay, lte: endOfDay },
      status: 'SCHEDULED' as AppointmentStatus,
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
    select: { id: true, startTime: true, endTime: true },
  });

  if (businessHour && businessHour.maxAppointments > 0 && otherScheduled.length >= businessHour.maxAppointments) {
    throw new AvailabilityError('No hay cupos disponibles para ese día');
  }

  const reqStartMinutes = timeToMinutes(startTime);
  const reqEndMinutes = timeToMinutes(endTime);

  const overlaps = otherScheduled.some((apt) => {
    const aptStart = timeToMinutes(apt.startTime);
    const aptEnd = timeToMinutes(apt.endTime);
    return reqStartMinutes < aptEnd && reqEndMinutes > aptStart;
  });

  if (overlaps) {
    throw new AvailabilityError('Ya existe una cita en ese horario. Por favor selecciona otro horario.', 409);
  }
}

interface CreateAppointmentParams {
  dateStr: string;
  startTime: string;
  endTime: string;
  clientId: string;
  productId: string;
  notes?: string;
  status?: AppointmentStatus;
}

const appointmentInclude = { client: true, product: true } as const;

/**
 * Comprueba disponibilidad y crea la cita en una única transacción
 * SERIALIZABLE. Dos peticiones concurrentes para el mismo hueco leen el
 * mismo estado "libre"; Postgres detecta el conflicto de escritura entre
 * ambas y aborta una de las dos en vez de dejar que las dos inserten.
 * El llamador debe capturar AvailabilityError (409/400) y el código
 * P2034 de Prisma (conflicto de serialización) y responder en consecuencia.
 */
export async function createAppointmentSafely(params: CreateAppointmentParams) {
  const { dateStr, startTime, endTime, clientId, productId, notes, status } = params;

  return prisma.$transaction(
    async (tx) => {
      await assertSlotAvailable(tx, { dateStr, startTime, endTime });

      return tx.appointment.create({
        data: {
          date: dayRangeUTC(dateStr).start,
          startTime,
          endTime,
          status: status ?? 'SCHEDULED',
          notes,
          clientId,
          productId,
        },
        include: appointmentInclude,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

interface UpdateAppointmentParams {
  id: string;
  dateStr: string;
  startTime: string;
  endTime: string;
  data: Prisma.AppointmentUpdateInput;
  /** Si la cita cambia de fecha/hora, hay que revalidar el hueco; si no, se puede omitir. */
  skipAvailabilityCheck?: boolean;
}

export async function updateAppointmentSafely(params: UpdateAppointmentParams) {
  const { id, dateStr, startTime, endTime, data, skipAvailabilityCheck } = params;

  return prisma.$transaction(
    async (tx) => {
      if (!skipAvailabilityCheck) {
        await assertSlotAvailable(tx, { dateStr, startTime, endTime, excludeAppointmentId: id });
      }

      return tx.appointment.update({
        where: { id },
        data,
        include: appointmentInclude,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

/** true si el error es un conflicto de serialización detectado por Postgres (P2034). */
export function isSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
  );
}
