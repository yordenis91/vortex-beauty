import { Prisma } from '@prisma/client';
import {
  addDaysToDateString,
  dayOfWeekFromDateString,
  instantToLocal,
  isValidDateString,
  localDayRange,
  localToInstant,
  minutesToTime,
  timeToMinutes,
} from '../../lib/time';
import { AvailabilityError } from './errors';

/**
 * Motor de disponibilidad: única fuente de verdad de "qué huecos se pueden
 * reservar". Lo usan el listado de huecos (portal, reserva pública, panel) y
 * la propia reserva, que vuelve a calcularlo dentro de su transacción.
 *
 * Un hueco es reservable cuando, para el servicio pedido, existe al menos un
 * profesional que: realiza el servicio, trabaja en ese tramo, no tiene una
 * ausencia, y no tiene otra cita que se solape (contando preparación y
 * limpieza); y, si el servicio necesita recurso, hay uno libre.
 */

export interface SlotQuery {
  tenantId: string;
  dateStr: string; // YYYY-MM-DD en la zona del salón
  serviceId: string;
  /** Un profesional concreto, o 'any' / undefined para cualquiera. */
  professionalId?: string | 'any' | null;
  /** Reserva pública: solo servicios y profesionales marcados como reservables online. */
  forPublic?: boolean;
  /** Aplica antelación mínima y máxima. El panel de administración las ignora. */
  enforceWindow?: boolean;
  /** Al reprogramar, la cita que se mueve no cuenta como ocupada. */
  excludeAppointmentId?: string;
  now?: Date;
}

export interface Slot {
  startTime: string; // HH:mm local
  startsAt: Date;
  endsAt: Date;
  blockStartsAt: Date;
  blockEndsAt: Date;
  /** Profesionales libres en este hueco, ordenados por menos carga ese día. */
  professionalIds: string[];
  /** Recurso libre asignable, si el servicio lo necesita. */
  resourceId: string | null;
  /** Subconjunto de professionalIds que reserva por cupos en este hueco (ver blockFor). */
  quotaProfessionalIds: string[];
}

/** Un cupo ocupa solo su hora exacta: el servicio no bloquea los cupos siguientes. */
const QUOTA_BLOCK_MS = 60_000;

/**
 * Tiempos con los que se guarda la cita según el profesional elegido. Quien
 * reserva por cupos bloquea solo el minuto del cupo (la restricción EXCLUDE de la
 * base impide dos citas en el mismo cupo) y no usa recurso.
 */
export function blockFor(slot: Slot, professionalId: string) {
  if (!slot.quotaProfessionalIds.includes(professionalId)) {
    return { blockStartsAt: slot.blockStartsAt, blockEndsAt: slot.blockEndsAt, resourceId: slot.resourceId };
  }
  return { blockStartsAt: slot.startsAt, blockEndsAt: new Date(slot.startsAt.getTime() + QUOTA_BLOCK_MS), resourceId: null };
}

export interface SlotsResult {
  slots: Slot[];
  /** Por qué no hay huecos, cuando la lista está vacía. */
  reason?: string;
  service: {
    id: string;
    name: string;
    price: Prisma.Decimal;
    currency: string;
    durationMinutes: number;
    bufferBeforeMin: number;
    bufferAfterMin: number;
  };
  timezone: string;
}

const ACTIVE_STATUSES = ['SCHEDULED', 'PENDING'] as const;

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();

export async function computeSlots(tx: Prisma.TransactionClient, q: SlotQuery): Promise<SlotsResult> {
  if (!isValidDateString(q.dateStr)) {
    throw new AvailabilityError('Fecha inválida (formato YYYY-MM-DD)');
  }
  const now = q.now ?? new Date();

  const [tenant, settingsRow, service] = await Promise.all([
    tx.tenant.findUniqueOrThrow({ where: { id: q.tenantId }, select: { timezone: true } }),
    tx.tenantSettings.findUnique({ where: { tenantId: q.tenantId } }),
    tx.service.findFirst({
      where: { id: q.serviceId, tenantId: q.tenantId },
      include: {
        professionals: {
          include: { professional: { include: { schedules: true, quotaSlots: true } } },
        },
        resources: { include: { resource: true } },
      },
    }),
  ]);

  if (!service || service.status !== 'ACTIVE') {
    throw new AvailabilityError('Servicio no encontrado', 400);
  }
  if (q.forPublic && !service.onlineBookable) {
    throw new AvailabilityError('Este servicio no se puede reservar en línea', 400);
  }

  const settings = {
    slotIntervalMin: settingsRow?.slotIntervalMin ?? 30,
    minNoticeHours: settingsRow?.minNoticeHours ?? 2,
    maxAdvanceDays: settingsRow?.maxAdvanceDays ?? 60,
  };
  const tz = tenant.timezone;
  const serviceInfo = {
    id: service.id,
    name: service.name,
    price: service.price,
    currency: service.currency,
    durationMinutes: service.durationMinutes,
    bufferBeforeMin: service.bufferBeforeMin,
    bufferAfterMin: service.bufferAfterMin,
  };
  const empty = (reason: string): SlotsResult => ({ slots: [], reason, service: serviceInfo, timezone: tz });

  // ---- Ventana de reserva (antelación mínima / máxima) ----
  if (q.enforceWindow) {
    const today = instantToLocal(tz, now).dateStr;
    if (q.dateStr > addDaysToDateString(today, settings.maxAdvanceDays)) {
      return empty(`Solo se puede reservar con hasta ${settings.maxAdvanceDays} días de antelación`);
    }
    if (q.dateStr < today) return empty('Esa fecha ya pasó');
  }

  // ---- Calendario del salón: día cerrado, excepción, horario comercial ----
  const dayOfWeek = dayOfWeekFromDateString(q.dateStr);
  const [closedDate, override, businessHour] = await Promise.all([
    tx.closedDate.findUnique({ where: { tenantId_date: { tenantId: q.tenantId, date: q.dateStr } } }),
    tx.scheduleOverride.findUnique({ where: { tenantId_date: { tenantId: q.tenantId, date: q.dateStr } } }),
    tx.businessHour.findUnique({ where: { tenantId_dayOfWeek: { tenantId: q.tenantId, dayOfWeek } } }),
  ]);

  if (closedDate) return empty('El salón está cerrado ese día');
  // Una excepción para la fecha abre el día aunque el horario habitual esté cerrado.
  if (!override && (!businessHour || !businessHour.isOpen)) return empty('El salón está cerrado ese día');

  const explicitStarts = override ? override.timeSlots : businessHour?.timeSlots ?? [];
  const useExplicit = explicitStarts.length > 0;

  // ---- Citas activas alrededor del día ----
  const day = localDayRange(tz, q.dateStr);
  const margin = 12 * 3600 * 1000;
  const busy = await tx.appointment.findMany({
    where: {
      tenantId: q.tenantId,
      status: { in: [...ACTIVE_STATUSES] },
      blockStartsAt: { lt: new Date(day.end.getTime() + margin) },
      blockEndsAt: { gt: new Date(day.start.getTime() - margin) },
      ...(q.excludeAppointmentId ? { id: { not: q.excludeAppointmentId } } : {}),
    },
    select: { professionalId: true, resourceId: true, blockStartsAt: true, blockEndsAt: true, startsAt: true },
  });

  // El tope diario del salón solo limita a quienes reservan por hora: el tope de
  // quien reserva por cupos es su propio número de cupos.
  const dayCount = busy.filter((a) => a.startsAt >= day.start && a.startsAt < day.end).length;
  const dayFull = !!businessHour && businessHour.maxAppointments > 0 && dayCount >= businessHour.maxAppointments;

  // ---- Profesionales elegibles ----
  const wanted = q.professionalId && q.professionalId !== 'any' ? q.professionalId : null;
  const eligible = service.professionals
    .map((ps) => ps.professional)
    .filter((p) => p.isActive && (!q.forPublic || p.acceptsOnlineBookings) && (!wanted || p.id === wanted));

  if (eligible.length === 0) {
    return empty(wanted ? 'Ese profesional no realiza este servicio' : 'No hay profesionales disponibles para este servicio');
  }

  const timeOffs = await tx.timeOff.findMany({
    where: {
      tenantId: q.tenantId,
      professionalId: { in: eligible.map((p) => p.id) },
      startsAt: { lt: day.end },
      endsAt: { gt: day.start },
    },
  });

  const timedPros = eligible.filter((p) => p.bookingMode === 'TIMED');
  const quotaPros = eligible.filter((p) => p.bookingMode === 'QUOTA');
  const timedOpen = timedPros.length > 0 && !dayFull;

  const resources = service.resources.map((sr) => sr.resource).filter((r) => r.isActive);
  if (timedOpen && service.resources.length > 0 && resources.length === 0 && quotaPros.length === 0) {
    return empty('No hay recursos disponibles para este servicio');
  }
  if (timedPros.length > 0 && dayFull && quotaPros.length === 0) {
    return empty('No hay cupos disponibles para ese día');
  }

  // ---- Horas candidatas ----
  const duration = service.durationMinutes;
  const candidates: string[] = [];
  if (!timedOpen) {
    // Nadie reserva por hora este día: solo quedan los cupos.
  } else if (useExplicit) {
    candidates.push(...explicitStarts);
  } else {
    const open = timeToMinutes(businessHour!.startTime);
    const close = timeToMinutes(businessHour!.endTime);
    for (let m = open; m + duration <= close; m += settings.slotIntervalMin) {
      candidates.push(minutesToTime(m));
    }
  }

  const loadByProfessional = new Map<string, number>();
  for (const a of busy) {
    if (a.professionalId && a.startsAt >= day.start && a.startsAt < day.end) {
      loadByProfessional.set(a.professionalId, (loadByProfessional.get(a.professionalId) ?? 0) + 1);
    }
  }

  const slots: Slot[] = [];
  const earliest = new Date(now.getTime() + settings.minNoticeHours * 3600 * 1000);

  for (const startTime of [...new Set(candidates)].sort()) {
    const startsAt = localToInstant(tz, q.dateStr, startTime);
    const endsAt = new Date(startsAt.getTime() + duration * 60000);
    const blockStartsAt = new Date(startsAt.getTime() - service.bufferBeforeMin * 60000);
    const blockEndsAt = new Date(endsAt.getTime() + service.bufferAfterMin * 60000);

    if (q.enforceWindow && startsAt < earliest) continue;

    const startMin = timeToMinutes(startTime);
    const endMin = startMin + duration;

    const free = timedPros.filter((p) => {
      const works = p.schedules.some((s) => s.dayOfWeek === dayOfWeek && timeToMinutes(s.startTime) <= startMin && timeToMinutes(s.endTime) >= endMin);
      if (!works) return false;
      if (timeOffs.some((t) => t.professionalId === p.id && overlaps(startsAt, endsAt, t.startsAt, t.endsAt))) return false;
      return !busy.some((a) => a.professionalId === p.id && overlaps(blockStartsAt, blockEndsAt, a.blockStartsAt, a.blockEndsAt));
    });
    if (free.length === 0) continue;

    let resourceId: string | null = null;
    if (service.resources.length > 0) {
      const freeResource = resources.find(
        (r) => !busy.some((a) => a.resourceId === r.id && overlaps(blockStartsAt, blockEndsAt, a.blockStartsAt, a.blockEndsAt))
      );
      if (!freeResource) continue;
      resourceId = freeResource.id;
    }

    free.sort((a, b) => (loadByProfessional.get(a.id) ?? 0) - (loadByProfessional.get(b.id) ?? 0));
    slots.push({
      startTime,
      startsAt,
      endsAt,
      blockStartsAt,
      blockEndsAt,
      professionalIds: free.map((p) => p.id),
      resourceId,
      quotaProfessionalIds: [],
    });
  }

  // ---- Cupos: horas exactas definidas por cada profesional para ese día de la semana ----
  for (const p of quotaPros) {
    for (const quota of p.quotaSlots.filter((slot) => slot.dayOfWeek === dayOfWeek)) {
      const startsAt = localToInstant(tz, q.dateStr, quota.time);
      const endsAt = new Date(startsAt.getTime() + duration * 60000);
      const blockEndsAt = new Date(startsAt.getTime() + QUOTA_BLOCK_MS);
      if (q.enforceWindow && startsAt < earliest) continue;
      if (timeOffs.some((t) => t.professionalId === p.id && overlaps(startsAt, endsAt, t.startsAt, t.endsAt))) continue;
      if (busy.some((a) => a.professionalId === p.id && overlaps(startsAt, blockEndsAt, a.blockStartsAt, a.blockEndsAt))) continue;

      const existing = slots.find((s) => s.startTime === quota.time);
      if (existing) {
        existing.professionalIds.push(p.id);
        existing.quotaProfessionalIds.push(p.id);
      } else {
        slots.push({
          startTime: quota.time,
          startsAt,
          endsAt,
          blockStartsAt: startsAt,
          blockEndsAt,
          professionalIds: [p.id],
          resourceId: null,
          quotaProfessionalIds: [p.id],
        });
      }
    }
  }
  slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (const s of slots) {
    s.professionalIds.sort((a, b) => (loadByProfessional.get(a) ?? 0) - (loadByProfessional.get(b) ?? 0));
  }

  return {
    slots,
    reason: slots.length === 0 ? 'No hay horarios disponibles ese día' : undefined,
    service: serviceInfo,
    timezone: tz,
  };
}
