import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import toast, { Toaster } from 'react-hot-toast'
import Appointments from './Appointments'
import { AuthProvider } from '../contexts/AuthContext'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'
import { ymd } from '../test/fixtures'
import { addDays, format } from 'date-fns'
import { es } from 'date-fns/locale/es'

/** Agenda del móvil: calendario arriba, citas del día abajo. */
const today = ymd(new Date())
const tomorrow = ymd(addDays(new Date(), 1))
const dow = new Date().getDay()

const allWeek = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ id: `bh${d}`, dayOfWeek: d, isOpen: true, startTime: '09:00', endTime: '18:00' }))

const apt = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  date: `${today}T00:00:00.000Z`,
  startTime: '10:00',
  endTime: '10:30',
  startsAt: `${today}T14:00:00.000Z`,
  endsAt: `${today}T14:30:00.000Z`,
  status: 'SCHEDULED',
  serviceName: 'Corte de cabello',
  priceAmount: '500',
  currency: 'CUP',
  durationMin: 30,
  clientId: 'c1',
  serviceId: 's1',
  professionalId: 'p1',
  client: { id: 'c1', name: 'Carlos Méndez', phone: '+53 5 555 1234' },
  professional: { id: 'p1', name: 'Yoel', color: '#ec4899' },
  ...over,
})

const posts: Array<{ url: string; body: Record<string, unknown> }> = []

function mock(appointments: unknown[], professionals: unknown[] = [{ id: 'p1', name: 'Yoel', isActive: true, color: '#ec4899', bookingMode: 'TIMED', schedules: [{ id: 's', dayOfWeek: dow, startTime: '09:00', endTime: '18:00' }], quotaSlots: [] }]) {
  const puts: Array<{ id: string; body: Record<string, unknown> }> = []
  posts.length = 0
  server.use(
    http.get(`${API}/settings/booking`, () => HttpResponse.json({ name: 'Barbería Demo', slug: 'barberia-demo', currency: 'CUP', timezone: 'America/Havana', vertical: 'BARBER', slotIntervalMin: 30, labels: {} })),
    http.get(`${API}/appointments`, () => HttpResponse.json(appointments)),
    http.get(`${API}/appointments/fully-booked-dates`, () => HttpResponse.json([])),
    http.get(`${API}/clients`, () => HttpResponse.json([{ id: 'c1', name: 'Carlos Méndez' }])),
    http.get(`${API}/services`, () => HttpResponse.json([{ id: 's1', name: 'Corte de cabello', status: 'ACTIVE', price: 500, currency: 'CUP', durationMinutes: 30 }])),
    http.get(`${API}/appointments/available-slots`, () => HttpResponse.json([{ startTime: '15:00', professionalIds: ['p1'] }, { startTime: '16:30', professionalIds: ['p1'] }])),
    http.post(`${API}/appointments`, async ({ request }) => {
      posts.push({ url: '/appointments', body: (await request.json()) as Record<string, unknown> })
      return HttpResponse.json(apt('nuevo'), { status: 201 })
    }),
    http.post(`${API}/clients`, async ({ request }) => {
      posts.push({ url: '/clients', body: (await request.json()) as Record<string, unknown> })
      return HttpResponse.json({ id: 'c-nuevo', name: 'Marta Díaz' }, { status: 201 })
    }),
    http.post(`${API}/professionals/:id/time-off`, async ({ request }) => {
      posts.push({ url: '/time-off', body: (await request.json()) as Record<string, unknown> })
      return HttpResponse.json({ id: 't1' }, { status: 201 })
    }),
    http.get(`${API}/professionals`, () => HttpResponse.json(professionals)),
    http.get(`${API}/professionals/:id/time-off`, () => HttpResponse.json([])),
    http.get(`${API}/settings/business-hours`, () => HttpResponse.json(allWeek)),
    http.get(`${API}/closed-dates`, () => HttpResponse.json([])),
    http.get(`${API}/overrides/:date`, () => HttpResponse.json({ error: 'Sin excepción' }, { status: 404 })),
    http.put(`${API}/appointments/:id`, async ({ params, request }) => {
      puts.push({ id: String(params.id), body: (await request.json()) as Record<string, unknown> })
      return HttpResponse.json(apt(String(params.id)))
    }),
  )
  return puts
}

// El dueño tiene sesión: solo quien administra ve el menú «Más opciones del día».
const open = () => {
  localStorage.setItem('hasSession', '1')
  server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.json({ user: { id: 'u1', email: 'dueno@demo.com', name: 'Yoel', role: 'OWNER', tenantId: 't1' }, token: 'tok' })))
  return renderWithProviders(
    <AuthProvider>
      <Toaster />
      <Appointments />
    </AuthProvider>,
  )
}

// Los huecos libres dependen de la hora actual: estas pruebas fijan «ahora» a mediodía de La Habana (solo Date).
const atMidday = () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${today}T17:00:00Z`))
}

const widthBefore = window.innerWidth
beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true })
})
afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(window, 'innerWidth', { value: widthBefore, configurable: true })
  toast.remove()
})

describe('Agenda del móvil', () => {
  it('muestra el calendario con puntos y la lista de citas del día elegido', async () => {
    mock([apt('a1'), apt('a2', { startTime: '12:00', endTime: '12:30', client: { id: 'c2', name: 'Luis Pérez' } }), apt('b1', { date: `${tomorrow}T00:00:00.000Z`, client: { id: 'c3', name: 'Marta Gil' } })])
    open()
    expect(await screen.findByText('Carlos Méndez')).toBeInTheDocument()
    expect(screen.getByText('Luis Pérez')).toBeInTheDocument()
    expect(screen.queryByText('Marta Gil')).not.toBeInTheDocument() // es de mañana
    expect(screen.getByText('2 citas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nueva cita' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Vista de la agenda' })).not.toBeInTheDocument() // sin el selector Día/Semana del escritorio
    // los días con citas lo dicen en su etiqueta
    expect(screen.getByRole('gridcell', { name: /, 2 citas/ })).toBeInTheDocument()
  })

  it('tocar otro día cambia la lista', async () => {
    mock([apt('a1'), apt('b1', { date: `${tomorrow}T00:00:00.000Z`, client: { id: 'c3', name: 'Marta Gil' } })])
    const user = userEvent.setup()
    open()
    await screen.findByText('Carlos Méndez')
    await user.click(screen.getByRole('gridcell', { name: /, 1 cita$/, selected: false }))
    expect(await screen.findByText('Marta Gil')).toBeInTheDocument()
    expect(screen.queryByText('Carlos Méndez')).not.toBeInTheDocument()
  })

  it('el asa pasa de mes a semana y vuelve', async () => {
    mock([apt('a1')])
    const user = userEvent.setup()
    open()
    await screen.findByText('Carlos Méndez')
    const monthCells = screen.getAllByRole('gridcell').length
    expect(monthCells).toBeGreaterThanOrEqual(28)
    await user.click(screen.getByRole('button', { name: 'Mostrar solo la semana' }))
    expect(screen.getAllByRole('gridcell')).toHaveLength(7)
    await user.click(screen.getByRole('button', { name: 'Mostrar el mes completo' }))
    expect(screen.getAllByRole('gridcell').length).toBe(monthCells)
  })

  it('tocar una cita abre la hoja de acciones; «Completar» la marca y ofrece «Deshacer»', async () => {
    const puts = mock([apt('a1')])
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByText('Carlos Méndez'))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByRole('link', { name: /Llamar/ })).toHaveAttribute('href', 'tel:+5355551234')
    expect(within(sheet).getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', expect.stringContaining('https://wa.me/5355551234?text='))
    await user.click(within(sheet).getByRole('button', { name: /Completar/ }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0].body).toEqual({ status: 'COMPLETED' })
    expect(await screen.findByRole('button', { name: 'Deshacer', hidden: true })).toBeInTheDocument() // oculto para lectores mientras la hoja termina de cerrarse
  })

  it('con un solo profesional ofrece los huecos libres entre citas y al tocar uno abre la cita con esa hora', async () => {
    atMidday()
    mock([apt('a1', { startTime: '10:00', endTime: '11:00' })])
    const user = userEvent.setup()
    open()
    await screen.findByText('Carlos Méndez')
    const gaps = screen.getAllByRole('button', { name: /^Libre / })
    expect(gaps.length).toBeGreaterThan(0)
    await user.click(gaps[gaps.length - 1])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Nueva cita')).toBeInTheDocument()
  })

  it('un día sin citas lo dice y no inventa huecos si no hay profesional elegido entre varios', async () => {
    mock([], [
      { id: 'p1', name: 'Yoel', isActive: true, color: '#ec4899', bookingMode: 'TIMED', schedules: [], quotaSlots: [] },
      { id: 'p2', name: 'Raúl', isActive: true, color: '#10b981', bookingMode: 'TIMED', schedules: [], quotaSlots: [] },
    ])
    open()
    expect(await screen.findByText('No hay citas este día')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filtrar por profesional' })).toBeInTheDocument()
  })

  it('cita nueva en pocos toques: busca al cliente, elige servicio y hora, y agenda', async () => {
    mock([])
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: 'Nueva cita' }))
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByRole('button', { name: 'Agendar' })).toBeDisabled()
    await user.type(within(sheet).getByLabelText(/Buscar o escribir/), 'carl')
    await user.click(await within(sheet).findByRole('button', { name: /Carlos Méndez/ }))
    await user.click(within(sheet).getByRole('button', { name: 'Corte de cabello' }))
    await user.click(await within(sheet).findByRole('button', { name: '16:30' }))
    await user.click(within(sheet).getByRole('button', { name: 'Agendar' }))
    await waitFor(() => expect(posts.filter((p) => p.url === '/appointments')).toHaveLength(1))
    expect(posts.find((p) => p.url === '/appointments')!.body).toMatchObject({ clientId: 'c1', serviceId: 's1', startTime: '16:30', professionalId: 'any', status: 'SCHEDULED' })
  })

  it('un cliente nuevo se crea al vuelo con su teléfono y luego se agenda', async () => {
    mock([])
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: 'Nueva cita' }))
    const sheet = await screen.findByRole('dialog')
    await user.type(within(sheet).getByLabelText(/Buscar o escribir/), 'Marta Díaz')
    await user.click(within(sheet).getByRole('button', { name: /Crear cliente «Marta Díaz»/ }))
    await user.type(within(sheet).getByLabelText('Teléfono del cliente nuevo'), '+53 5 555 7777')
    await user.click(within(sheet).getByRole('button', { name: 'Corte de cabello' }))
    await user.click(await within(sheet).findByRole('button', { name: '15:00' }))
    await user.click(within(sheet).getByRole('button', { name: 'Agendar' }))
    await waitFor(() => expect(posts.filter((p) => p.url === '/appointments')).toHaveLength(1))
    expect(posts[0]).toEqual({ url: '/clients', body: { name: 'Marta Díaz', phone: '+53 5 555 7777' } })
    expect(posts[1].body).toMatchObject({ clientId: 'c-nuevo', startTime: '15:00' })
  })

  it('«Próxima cita en 3 sem» abre la hoja con el mismo cliente y servicio, tres semanas después', async () => {
    mock([apt('a1', { status: 'COMPLETED' })])
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByText('Carlos Méndez'))
    const sheet = await screen.findByRole('dialog')
    await user.click(within(within(sheet).getByRole('group', { name: 'Próxima cita' })).getByRole('button', { name: '3 sem' }))
    const next = await screen.findByRole('dialog', { name: /Nueva cita/ })
    expect(within(next).getByText(format(addDays(new Date(), 21), "EEEE d 'de' MMMM", { locale: es }))).toBeInTheDocument()
    expect(within(next).getByText('Carlos Méndez')).toBeInTheDocument()
    expect(within(next).getByRole('button', { name: 'Corte de cabello' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('bloquear horas crea la ausencia del profesional en la zona del salón', async () => {
    mock([])
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: 'Más opciones del día' }))
    await user.click(await screen.findByRole('menuitem', { name: /Bloquear horas/ }))
    const sheet = await screen.findByRole('dialog')
    await user.type(within(sheet).getByLabelText(/Motivo/), 'Almuerzo')
    await user.click(within(sheet).getByRole('button', { name: 'Bloquear' }))
    await waitFor(() => expect(posts.filter((p) => p.url === '/time-off')).toHaveLength(1))
    const body = posts[0].body as { startsAt: string; endsAt: string; reason: string }
    expect(body.reason).toBe('Almuerzo')
    expect(body.startsAt).toMatch(/T1[67]:00:00\.000Z$/) // 12:00 en La Habana: 16:00 o 17:00 UTC según el horario de verano
    expect(new Date(body.endsAt).getTime() - new Date(body.startsAt).getTime()).toBe(3600000)
  })

  it('«Copiar horas libres» deja en el portapapeles un texto para WhatsApp', async () => {
    atMidday()
    mock([apt('a1', { startTime: '10:00', endTime: '11:00' })])
    const user = userEvent.setup()
    const writes: string[] = []
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => { writes.push(t) } }, configurable: true })
    open()
    await screen.findByText('Carlos Méndez')
    await user.click(screen.getByRole('button', { name: 'Más opciones del día' }))
    await user.click(await screen.findByRole('menuitem', { name: /Copiar horas libres/ }))
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toMatch(/^Barbería Demo: horas libres el .+: .*\d\d:\d\d.*\. ¿Cuál te viene bien\?$/)
  })
})
