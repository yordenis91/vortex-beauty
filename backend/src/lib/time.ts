import { DateTime } from 'luxon';

/**
 * Conversión entre la hora local de un salón (zona IANA de Tenant.timezone) y
 * los instantes absolutos que se guardan en la base de datos.
 */

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440;
  const hh = Math.floor(wrapped / 60).toString().padStart(2, '0');
  const mm = (wrapped % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Instante absoluto de una fecha "YYYY-MM-DD" y hora "HH:mm" locales. */
export function localToInstant(timezone: string, dateStr: string, time: string): Date {
  const dt = DateTime.fromISO(`${dateStr}T${time}`, { zone: timezone });
  if (!dt.isValid) {
    throw new Error(`Fecha u hora inválida: ${dateStr} ${time} (${timezone})`);
  }
  return dt.toJSDate();
}

export interface LocalParts {
  dateStr: string; // YYYY-MM-DD
  time: string; // HH:mm
  dayOfWeek: number; // 0 = domingo ... 6 = sábado
}

export function instantToLocal(timezone: string, instant: Date): LocalParts {
  const dt = DateTime.fromJSDate(instant, { zone: timezone });
  return {
    dateStr: dt.toFormat('yyyy-MM-dd'),
    time: dt.toFormat('HH:mm'),
    // Luxon: lunes = 1 ... domingo = 7
    dayOfWeek: dt.weekday % 7,
  };
}

/** Día de la semana (0 = domingo) de una fecha de calendario, sin depender de ninguna zona. */
export function dayOfWeekFromDateString(dateStr: string): number {
  return DateTime.fromISO(dateStr, { zone: 'utc' }).weekday % 7;
}

/** Inicio y fin (instantes) del día local, para consultar citas de ese día. */
export function localDayRange(timezone: string, dateStr: string): { start: Date; end: Date } {
  const start = DateTime.fromISO(dateStr, { zone: timezone }).startOf('day');
  return { start: start.toJSDate(), end: start.plus({ days: 1 }).toJSDate() };
}

export function isValidTimezone(timezone: string): boolean {
  return DateTime.local().setZone(timezone).isValid;
}

export function isValidDateString(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && DateTime.fromISO(dateStr, { zone: 'utc' }).isValid;
}

export function addDaysToDateString(dateStr: string, days: number): string {
  return DateTime.fromISO(dateStr, { zone: 'utc' }).plus({ days }).toFormat('yyyy-MM-dd');
}
