import type { ManageView, PublicCatalog } from '../lib/publicApi'

export const SLUG = 'barberia-demo'

export const catalog = (over: Partial<PublicCatalog> = {}): PublicCatalog => ({
  name: 'Barbería Demo',
  slug: SLUG,
  timezone: 'America/Havana',
  currency: 'CUP',
  bookingEnabled: true,
  labels: { appointment: 'turno', appointments: 'turnos', service: 'servicio', services: 'servicios' },
  minNoticeHours: 2,
  maxAdvanceDays: 60,
  cancelWindowHrs: 12,
  captchaSiteKey: null,
  services: [
    { id: 's-corte', name: 'Corte de cabello', description: null, price: '500', currency: 'CUP', durationMinutes: 30, category: { id: 'c1', name: 'Cortes' } },
    { id: 's-barba', name: 'Arreglo de barba', description: 'Con navaja', price: '300', currency: 'CUP', durationMinutes: 20, category: { id: 'c2', name: 'Barba' } },
  ],
  professionals: [{ id: 'p-yoel', name: 'Yoel', color: '#ec4899', serviceIds: ['s-corte', 's-barba'] }],
  ...over,
})

const pad = (n: number) => String(n).padStart(2, '0')
/** Fecha local en formato YYYY-MM-DD. */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Todas las fechas entre `from` y `to` (inclusive), como las devolvería el endpoint de días con huecos. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = []
  const cursor = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  while (cursor <= end) {
    out.push(ymd(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

export const manageView = (over: { status?: ManageView['appointment']['status']; canCancel?: boolean; telegram?: ManageView['telegram'] } = {}): ManageView => ({
  salonName: 'Barbería Demo',
  appointment: {
    id: 'a1',
    status: over.status ?? 'SCHEDULED',
    serviceName: 'Corte de cabello',
    professionalName: 'Yoel',
    date: '2030-03-04T00:00:00.000Z',
    startTime: '10:00',
    endTime: '10:30',
    startsAt: '2030-03-04T15:00:00.000Z',
    priceAmount: '500',
    currency: 'CUP',
    manageUrl: '/barberia-demo/mi-cita/tok',
    serviceId: 's-corte',
    professionalId: 'p-yoel',
  },
  telegram: over.telegram ?? null,
  cancelWindowHrs: 12,
  canCancel: over.canCancel ?? true,
  canReschedule: over.canCancel ?? true,
})
