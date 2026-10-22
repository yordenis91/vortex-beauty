import { eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import type { Appointment, Professional, TimeOff } from '../types';

/** Lógica pura de la agenda del móvil: cuadrícula, marcas por día, huecos libres y línea de tiempo. */

const WEEK = { weekStartsOn: 1 as const };

export const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
export const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const toHHmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Semanas completas (lunes a domingo) que cubren el mes. */
export const monthGrid = (anchor: Date): Date[] =>
  eachDayOfInterval({ start: startOfWeek(startOfMonth(anchor), WEEK), end: endOfWeek(endOfMonth(anchor), WEEK) });

export const weekOf = (anchor: Date): Date[] =>
  eachDayOfInterval({ start: startOfWeek(anchor, WEEK), end: endOfWeek(anchor, WEEK) });

/** Fecha y hora locales de un instante en la zona horaria del salón. */
export function localParts(timezone: string, at: Date = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

/** Instante UTC (ISO) de una fecha y hora locales del salón. */
export function localToIso(timezone: string, date: string, time: string): string {
  const guess = new Date(`${date}T${time}:00Z`);
  // El desfase de la zona en ese momento se calcula comparando la hora local con la UTC.
  const local = localParts(timezone, guess);
  const asUtc = new Date(`${local.date}T${local.time}:00Z`).getTime();
  const offset = asUtc - guess.getTime();
  return new Date(guess.getTime() - offset).toISOString();
}

// ---------- Marcas del calendario ----------

const COUNTED = new Set(['SCHEDULED', 'PENDING', 'COMPLETED']);
const STATUS_DOT: Record<string, string> = { SCHEDULED: '#3b82f6', PENDING: '#f59e0b', COMPLETED: '#10b981' };

export interface DayMark {
  count: number;
  /** Hasta tres colores distintos: el de cada profesional, o el del estado si hay uno solo. */
  colors: string[];
}

export function marksByDate(appointments: Appointment[], byProfessional: boolean): Map<string, DayMark> {
  const marks = new Map<string, DayMark>();
  for (const a of appointments) {
    if (!COUNTED.has(a.status)) continue;
    const key = a.date.split('T')[0];
    const mark = marks.get(key) ?? { count: 0, colors: [] };
    mark.count += 1;
    const color = byProfessional ? a.professional?.color || '#3b82f6' : STATUS_DOT[a.status];
    if (mark.colors.length < 3 && !mark.colors.includes(color)) mark.colors.push(color);
    marks.set(key, mark);
  }
  return marks;
}

// ---------- Huecos libres ----------

export interface Window {
  start: number;
  end: number;
  /** Cupo de un profesional que reserva por cupos: una hora exacta, no un rango. */
  cupo?: boolean;
}

export interface Busy {
  start: number;
  end: number;
}

const ACTIVE = new Set(['SCHEDULED', 'PENDING']);

/** Minutos de un día cubiertos por una ausencia (en la zona del salón); null si no toca ese día. */
export function blockOnDay(timezone: string, dateStr: string, off: Pick<TimeOff, 'startsAt' | 'endsAt'>): Busy | null {
  const s = localParts(timezone, new Date(off.startsAt));
  const e = localParts(timezone, new Date(off.endsAt));
  if (s.date > dateStr || e.date < dateStr) return null;
  const start = s.date < dateStr ? 0 : toMin(s.time);
  const end = e.date > dateStr ? 24 * 60 : toMin(e.time);
  return start < end ? { start, end } : null;
}

export interface FreeWindowsInput {
  professional: Pick<Professional, 'id' | 'bookingMode' | 'schedules' | 'quotaSlots'>;
  dayOfWeek: number;
  businessHour?: { isOpen: boolean; startTime: string; endTime: string } | null;
  appointments: Appointment[];
  blocks?: Busy[];
  minGap?: number;
}

export function freeWindows({ professional, dayOfWeek, businessHour, appointments, blocks = [], minGap = 30 }: FreeWindowsInput): Window[] {
  if (businessHour && !businessHour.isOpen) return [];
  const mine = appointments.filter((a) => a.professionalId === professional.id && ACTIVE.has(a.status));

  if (professional.bookingMode === 'QUOTA') {
    return (professional.quotaSlots ?? [])
      .filter((q) => q.dayOfWeek === dayOfWeek)
      .map((q) => toMin(q.time))
      .filter((start) => !mine.some((a) => toMin(a.startTime) === start) && !blocks.some((b) => start >= b.start && start < b.end))
      .sort((a, b) => a - b)
      .map((start) => ({ start, end: start + 1, cupo: true }));
  }

  const open = businessHour ? { start: toMin(businessHour.startTime), end: toMin(businessHour.endTime) } : { start: 0, end: 24 * 60 };
  const busy: Busy[] = [...mine.map((a) => ({ start: toMin(a.startTime), end: toMin(a.endTime) })), ...blocks].sort((a, b) => a.start - b.start);
  const result: Window[] = [];
  for (const s of (professional.schedules ?? []).filter((x) => x.dayOfWeek === dayOfWeek)) {
    let cursor = Math.max(toMin(s.startTime), open.start);
    const limit = Math.min(toMin(s.endTime), open.end);
    for (const b of busy) {
      if (b.end <= cursor) continue;
      if (b.start >= limit) break;
      if (b.start - cursor >= minGap) result.push({ start: cursor, end: b.start });
      cursor = Math.max(cursor, b.end);
    }
    if (limit - cursor >= minGap) result.push({ start: cursor, end: limit });
  }
  return result.sort((a, b) => a.start - b.start);
}

// ---------- Línea de tiempo del día ----------

export type TimelineItem =
  | { kind: 'appointment'; key: string; start: number; appointment: Appointment }
  | { kind: 'gap'; key: string; start: number; end: number; cupo?: boolean; professionalId: string }
  | { kind: 'block'; key: string; start: number; end: number; reason?: string | null; timeOffId: string }
  | { kind: 'now'; key: string; start: number };

export interface TimelineInput {
  appointments: Appointment[];
  /** Quien aporta los huecos libres; sin él solo salen las citas. */
  gapsFor?: Pick<Professional, 'id' | 'bookingMode' | 'schedules' | 'quotaSlots'> | null;
  dayOfWeek: number;
  businessHour?: { isOpen: boolean; startTime: string; endTime: string } | null;
  closed?: boolean;
  timeOffs?: Array<{ id: string; reason?: string | null; busy: Busy }>;
  /** Hora actual del salón en minutos, solo si el día mostrado es hoy. */
  nowMin?: number | null;
}

export function buildTimeline(input: TimelineInput): TimelineItem[] {
  const items: TimelineItem[] = input.appointments.map((a) => ({ kind: 'appointment', key: a.id, start: toMin(a.startTime), appointment: a }));
  const blocks = (input.timeOffs ?? []).map((t) => t.busy);

  for (const t of input.timeOffs ?? []) {
    items.push({ kind: 'block', key: `block-${t.id}`, start: t.busy.start, end: t.busy.end, reason: t.reason, timeOffId: t.id });
  }

  if (input.gapsFor && !input.closed) {
    const windows = freeWindows({
      professional: input.gapsFor,
      dayOfWeek: input.dayOfWeek,
      businessHour: input.businessHour,
      appointments: input.appointments,
      blocks,
    });
    for (const w of windows) {
      // Un hueco que ya pasó hoy no se ofrece.
      if (input.nowMin != null && w.end <= input.nowMin) continue;
      const start = input.nowMin != null && !w.cupo ? Math.max(w.start, roundUp(input.nowMin, 5)) : w.start;
      if (!w.cupo && w.end - start < 30) continue;
      items.push({ kind: 'gap', key: `gap-${w.start}`, start, end: w.end, cupo: w.cupo, professionalId: input.gapsFor.id });
    }
  }

  if (input.nowMin != null) items.push({ kind: 'now', key: 'now', start: input.nowMin });
  // A igual hora: primero la cita, luego el hueco; la línea de ahora va antes de lo que empieza después.
  const order = { now: 0, appointment: 1, block: 2, gap: 3 } as const;
  return items.sort((a, b) => a.start - b.start || order[a.kind] - order[b.kind]);
}

const roundUp = (min: number, step: number) => Math.ceil(min / step) * step;

/** Texto corto de una duración en minutos: "1 h 30 min". */
export function durationText(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} h ${m} min`;
  return h ? `${h} h` : `${m} min`;
}

/** Cuánto falta para una hora, en palabras: "en 25 min", "en 2 h", "ahora". */
export function untilText(minutes: number): string {
  if (minutes <= 0) return 'ahora';
  if (minutes < 60) return `en ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `en ${h} h ${m} min` : `en ${h} h`;
}

// ---------- Siguiente cita ----------

export interface NextAppointment {
  appointment: Appointment;
  /** «now»: ya empezó y no ha terminado; «upcoming»: todavía falta. */
  state: 'now' | 'upcoming';
  /** Minutos hasta que empieza, solo si es hoy. */
  minutesUntil: number | null;
}

/** La cita activa que está en curso o la próxima que viene, con la hora actual del salón. */
export function nextAppointment(appointments: Appointment[], now: { date: string; time: string }): NextAppointment | null {
  const nowMin = toMin(now.time);
  const active = appointments
    .filter((a) => a.status === 'SCHEDULED' || a.status === 'PENDING')
    .map((a) => ({ a, day: a.date.split('T')[0] }))
    .filter(({ a, day }) => day > now.date || (day === now.date && toMin(a.endTime) > nowMin))
    .sort((x, y) => (x.day + x.a.startTime).localeCompare(y.day + y.a.startTime));
  const first = active[0];
  if (!first) return null;
  if (first.day !== now.date) return { appointment: first.a, state: 'upcoming', minutesUntil: null };
  const start = toMin(first.a.startTime);
  return start <= nowMin
    ? { appointment: first.a, state: 'now', minutesUntil: 0 }
    : { appointment: first.a, state: 'upcoming', minutesUntil: start - nowMin };
}
