import { describe, it, expect } from 'vitest'
import { blockOnDay, buildTimeline, durationText, freeWindows, localParts, localToIso, marksByDate, monthGrid, nextAppointment, untilText, weekOf, ymd } from './agenda'
import type { Appointment } from '../types'

const apt = (over: Partial<Appointment> & { startTime: string; endTime: string }): Appointment =>
  ({
    id: `a-${over.startTime}`,
    date: '2026-10-22T00:00:00.000Z',
    status: 'SCHEDULED',
    professionalId: 'p1',
    professional: { id: 'p1', name: 'Ana', color: '#ec4899' },
    ...over,
  }) as unknown as Appointment

const pro = { id: 'p1', bookingMode: 'TIMED' as const, schedules: [{ id: 's', dayOfWeek: 4, startTime: '09:00', endTime: '18:00' }], quotaSlots: [] }
const quota = { id: 'p1', bookingMode: 'QUOTA' as const, schedules: [], quotaSlots: [{ dayOfWeek: 4, time: '09:00' }, { dayOfWeek: 4, time: '13:00' }] }

describe('cuadrícula', () => {
  it('el mes empieza en lunes y termina en domingo', () => {
    const days = monthGrid(new Date(2026, 9, 15)) // octubre 2026
    expect(ymd(days[0])).toBe('2026-09-28')
    expect(ymd(days[days.length - 1])).toBe('2026-11-01')
    expect(days).toHaveLength(35)
  })
  it('la semana va de lunes a domingo', () => {
    const w = weekOf(new Date(2026, 9, 22)) // jueves
    expect(w.map(ymd)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'])
  })
})

describe('zona horaria', () => {
  it('convierte un instante a la fecha y hora del salón', () => {
    expect(localParts('America/Havana', new Date('2026-10-22T17:30:00Z'))).toEqual({ date: '2026-10-22', time: '13:30' })
    expect(localParts('America/Havana', new Date('2026-10-22T02:00:00Z'))).toEqual({ date: '2026-10-21', time: '22:00' })
  })
  it('convierte una hora local a UTC y de vuelta', () => {
    const iso = localToIso('America/Havana', '2026-10-22', '13:00')
    expect(iso).toBe('2026-10-22T17:00:00.000Z') // UTC-4 en octubre
    expect(localParts('America/Havana', new Date(iso))).toEqual({ date: '2026-10-22', time: '13:00' })
    expect(localToIso('America/Havana', '2026-12-01', '09:00')).toBe('2026-12-01T14:00:00.000Z') // UTC-5 en invierno
  })
  it('una ausencia que cruza medianoche ocupa solo la parte del día pedido', () => {
    const off = { startsAt: '2026-10-22T20:00:00Z', endsAt: '2026-10-23T14:00:00Z' } // 16:00 → 10:00 del siguiente
    expect(blockOnDay('America/Havana', '2026-10-22', off)).toEqual({ start: 16 * 60, end: 24 * 60 })
    expect(blockOnDay('America/Havana', '2026-10-23', off)).toEqual({ start: 0, end: 10 * 60 })
    expect(blockOnDay('America/Havana', '2026-10-24', off)).toBeNull()
  })
})

describe('marcas por día', () => {
  it('cuenta las citas activas y completadas; las canceladas no marcan', () => {
    const marks = marksByDate(
      [apt({ startTime: '09:00', endTime: '10:00' }), apt({ startTime: '11:00', endTime: '12:00', status: 'COMPLETED' }), apt({ startTime: '13:00', endTime: '14:00', status: 'CANCELLED' })],
      false,
    )
    expect(marks.get('2026-10-22')).toEqual({ count: 2, colors: ['#3b82f6', '#10b981'] })
  })
  it('con varios profesionales usa su color y no pasa de tres', () => {
    const colors = ['#111111', '#222222', '#333333', '#444444']
    const list = colors.map((c, i) => apt({ startTime: `0${i + 1}:00`, endTime: `0${i + 1}:30`, professional: { id: `p${i}`, name: 'x', color: c } as never }))
    const mark = marksByDate(list, true).get('2026-10-22')!
    expect(mark.count).toBe(4)
    expect(mark.colors).toEqual(['#111111', '#222222', '#333333'])
  })
})

describe('huecos libres', () => {
  const open = { isOpen: true, startTime: '09:00', endTime: '18:00' }
  it('el día entero libre es un solo hueco', () => {
    expect(freeWindows({ professional: pro, dayOfWeek: 4, businessHour: open, appointments: [] })).toEqual([{ start: 540, end: 1080 }])
  })
  it('las citas parten el día y los huecos cortos no se ofrecen', () => {
    const w = freeWindows({
      professional: pro,
      dayOfWeek: 4,
      businessHour: open,
      appointments: [apt({ startTime: '10:00', endTime: '11:30' }), apt({ startTime: '11:45', endTime: '17:30' })],
    })
    // 09:00–10:00 y 17:30–18:00 caben (≥ 30 min); 11:30–11:45 es de 15 min y no se ofrece
    expect(w).toEqual([{ start: 540, end: 600 }, { start: 1050, end: 1080 }])
  })
  it('un día sin horario del profesional, o cerrado, no tiene huecos', () => {
    expect(freeWindows({ professional: pro, dayOfWeek: 2, businessHour: open, appointments: [] })).toEqual([])
    expect(freeWindows({ professional: pro, dayOfWeek: 4, businessHour: { ...open, isOpen: false }, appointments: [] })).toEqual([])
  })
  it('una ausencia por horas bloquea esa parte', () => {
    const w = freeWindows({ professional: pro, dayOfWeek: 4, businessHour: open, appointments: [], blocks: [{ start: 12 * 60, end: 13 * 60 }] })
    expect(w).toEqual([{ start: 540, end: 720 }, { start: 780, end: 1080 }])
  })
  it('con cupos, cada cupo sin cita es un hueco', () => {
    const w = freeWindows({ professional: quota, dayOfWeek: 4, businessHour: open, appointments: [apt({ startTime: '09:00', endTime: '11:30' })] })
    expect(w).toEqual([{ start: 780, end: 781, cupo: true }])
  })
})

describe('línea de tiempo', () => {
  const open = { isOpen: true, startTime: '09:00', endTime: '18:00' }
  it('ordena citas, huecos y la línea de ahora', () => {
    const items = buildTimeline({
      appointments: [apt({ startTime: '10:00', endTime: '11:00' }), apt({ startTime: '15:00', endTime: '16:00' })],
      gapsFor: pro,
      dayOfWeek: 4,
      businessHour: open,
      nowMin: 12 * 60,
    })
    // el hueco de la mañana ya pasó y no sale; el de 11:00 se recorta a la hora actual
    expect(items.map((i) => `${i.kind}@${i.start}`)).toEqual(['appointment@600', 'now@720', 'gap@720', 'appointment@900', 'gap@960'])
  })
  it('hoy no ofrece huecos que ya pasaron y recorta el que está en curso', () => {
    const items = buildTimeline({ appointments: [], gapsFor: pro, dayOfWeek: 4, businessHour: open, nowMin: 14 * 60 + 3 })
    const gap = items.find((i) => i.kind === 'gap')!
    expect(gap).toMatchObject({ start: 14 * 60 + 5, end: 18 * 60 })
  })
  it('sin profesional elegido solo salen las citas; un día cerrado tampoco ofrece huecos', () => {
    const a = [apt({ startTime: '10:00', endTime: '11:00' })]
    expect(buildTimeline({ appointments: a, dayOfWeek: 4, businessHour: open }).map((i) => i.kind)).toEqual(['appointment'])
    expect(buildTimeline({ appointments: a, gapsFor: pro, dayOfWeek: 4, businessHour: open, closed: true }).map((i) => i.kind)).toEqual(['appointment'])
  })
  it('las ausencias salen como bloques y no se ofrecen como huecos', () => {
    const items = buildTimeline({
      appointments: [],
      gapsFor: pro,
      dayOfWeek: 4,
      businessHour: open,
      timeOffs: [{ id: 't1', reason: 'Almuerzo', busy: { start: 12 * 60, end: 13 * 60 } }],
    })
    expect(items.map((i) => `${i.kind}@${i.start}`)).toEqual(['gap@540', 'block@720', 'gap@780'])
  })
})

describe('textos', () => {
  it('duraciones y cuenta atrás', () => {
    expect(durationText(45)).toBe('45 min')
    expect(durationText(90)).toBe('1 h 30 min')
    expect(durationText(120)).toBe('2 h')
    expect(untilText(0)).toBe('ahora')
    expect(untilText(25)).toBe('en 25 min')
    expect(untilText(120)).toBe('en 2 h')
    expect(untilText(135)).toBe('en 2 h 15 min')
  })
})

describe('siguiente cita', () => {
  const day = (d: string, over: Partial<Appointment> & { startTime: string; endTime: string }) => apt({ date: `${d}T00:00:00.000Z`, id: `${d}-${over.startTime}`, ...over })
  const list = [
    day('2026-10-22', { startTime: '09:00', endTime: '10:00' }),
    day('2026-10-22', { startTime: '13:00', endTime: '14:00' }),
    day('2026-10-23', { startTime: '09:00', endTime: '10:00' }),
    day('2026-10-22', { startTime: '15:00', endTime: '16:00', status: 'CANCELLED' }),
  ]
  it('la que viene hoy, con los minutos que faltan', () => {
    const n = nextAppointment(list, { date: '2026-10-22', time: '10:30' })!
    expect(n.appointment.startTime).toBe('13:00')
    expect(n).toMatchObject({ state: 'upcoming', minutesUntil: 150 })
  })
  it('la que está en curso cuenta como «ahora»', () => {
    const n = nextAppointment(list, { date: '2026-10-22', time: '13:20' })!
    expect(n).toMatchObject({ state: 'now', minutesUntil: 0 })
    expect(n.appointment.startTime).toBe('13:00')
  })
  it('si hoy ya no queda ninguna, la de otro día; las canceladas no cuentan', () => {
    const n = nextAppointment(list, { date: '2026-10-22', time: '14:30' })!
    expect(n.appointment.id).toBe('2026-10-23-09:00')
    expect(n.minutesUntil).toBeNull()
    expect(nextAppointment(list, { date: '2026-10-24', time: '08:00' })).toBeNull()
  })
})
