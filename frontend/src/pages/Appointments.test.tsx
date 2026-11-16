import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import Appointments from './Appointments'
import toast, { Toaster } from 'react-hot-toast'
import { AuthProvider } from '../contexts/AuthContext'
import { cancelDelay } from '../hooks/useAppointmentActions'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'
import { ymd } from '../test/fixtures'

const today = ymd(new Date())

const settings = (labels: Record<string, string>) => ({
  name: 'Barbería Demo', slug: 'barberia-demo', currency: 'CUP', timezone: 'America/Havana', vertical: 'BARBER',
  slotIntervalMin: 30, labels,
})

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
  client: { id: 'c1', name: 'Carlos Méndez' },
  professional: { id: 'p1', name: 'Yoel' },
  ...over,
})

function mockAgenda(appointments: unknown[], labels: Record<string, string> = {}) {
  const puts: Array<{ id: string; body: Record<string, unknown> }> = []
  server.use(
    http.get(`${API}/settings/booking`, () => HttpResponse.json(settings(labels))),
    http.get(`${API}/appointments`, () => HttpResponse.json(appointments)),
    http.get(`${API}/appointments/fully-booked-dates`, () => HttpResponse.json([])),
    http.get(`${API}/clients`, () => HttpResponse.json([{ id: 'c1', name: 'Carlos Méndez' }])),
    http.get(`${API}/services`, () => HttpResponse.json([])),
    http.get(`${API}/professionals`, () => HttpResponse.json([{ id: 'p1', name: 'Yoel', isActive: true, color: '#ec4899' }])),
    http.get(`${API}/settings/business-hours`, () => HttpResponse.json(allWeek)),
    http.get(`${API}/closed-dates`, () => HttpResponse.json([])),
    http.put(`${API}/appointments/:id`, async ({ params, request }) => {
      puts.push({ id: String(params.id), body: (await request.json()) as Record<string, unknown> })
      return HttpResponse.json(apt(String(params.id)))
    }),
  )
  return puts
}

const open = () =>
  renderWithProviders(
    <AuthProvider>
      <Toaster />
      <Appointments />
    </AuthProvider>,
  )

afterEach(() => {
  vi.restoreAllMocks()
  cancelDelay.ms = 5000
  toast.remove() // los avisos son globales: que uno no pase a la prueba siguiente
})

describe('Agenda de citas', () => {
  it('muestra las citas del día con hora, cliente, servicio, profesional y estado, ordenadas por hora', async () => {
    mockAgenda([apt('a2', { startTime: '12:00', endTime: '12:30', client: { id: 'c2', name: 'Luis Pérez' }, serviceName: 'Arreglo de barba' }), apt('a1')])
    open()
    expect(await screen.findByText('Carlos Méndez')).toBeInTheDocument()
    const cards = screen.getAllByText(/^\d{2}:\d{2} - \d{2}:\d{2}$/).map((n) => n.textContent)
    expect(cards).toEqual(['10:00 - 10:30', '12:00 - 12:30'])
    expect(screen.getByText('Luis Pérez')).toBeInTheDocument()
    expect(screen.getByText('Arreglo de barba')).toBeInTheDocument()
    expect(screen.getAllByText('Yoel').length).toBeGreaterThan(0)
  })

  it('no mezcla citas de otros días', async () => {
    mockAgenda([apt('a1'), apt('a9', { date: '2031-01-01T00:00:00.000Z', client: { id: 'c9', name: 'Otro Día' } })])
    open()
    await screen.findByText('Carlos Méndez')
    expect(screen.queryByText('Otro Día')).not.toBeInTheDocument()
  })

  it('usa el vocabulario del oficio en títulos, botones y textos', async () => {
    mockAgenda([apt('a1')], { appointment: 'turno', appointments: 'turnos', customer: 'cliente', professional: 'barbero', professionals: 'barberos' })
    open()
    expect(await screen.findByText('Agenda de Turnos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nuevo turno/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Editar turno/ })).toBeInTheDocument()
    expect(screen.getByText(/Gestiona los turnos de tu negocio/)).toBeInTheDocument()
    expect(screen.queryByText(/salón de belleza/)).not.toBeInTheDocument()
  })

  it('con vocabulario femenino concuerda el género («Nueva sesión»)', async () => {
    mockAgenda([], { appointment: 'sesión', appointments: 'sesiones' })
    open()
    expect(await screen.findByRole('button', { name: /Nueva sesión/ })).toBeInTheDocument()
    expect(await screen.findByText('No hay sesiones programadas para este día.')).toBeInTheDocument()
  })

  it('un día sin citas lo dice', async () => {
    mockAgenda([])
    open()
    expect(await screen.findByText('No hay citas programadas para este día.')).toBeInTheDocument()
  })

  it('«Completar» marca la cita como completada en el servidor', async () => {
    const puts = mockAgenda([apt('a1')])
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: 'Completar' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]).toEqual({ id: 'a1', body: { status: 'COMPLETED' } })
  })

  it('si llegas desde el buscador (?fecha=&cita=) se abre esa cita para editarla', async () => {
    mockAgenda([apt('a1')])
    server.use(
      http.get(`${API}/overrides/:date`, () => HttpResponse.json({ error: 'Sin excepción' }, { status: 404 })),
      http.get(`${API}/appointments/available-slots`, () => HttpResponse.json([])),
    )
    renderWithProviders(
      <AuthProvider>
        <Appointments />
      </AuthProvider>,
      { route: `/admin/appointments?fecha=${today}&cita=a1` },
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Editar cita/)).toBeInTheDocument()
  })

  it('sin conexión, cambiar el estado de una cita no hace nada y avisa de que necesita internet', async () => {
    const puts = mockAgenda([apt('a1')])
    const user = userEvent.setup()
    open()
    await screen.findByText('Carlos Méndez')
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    try {
      await user.click(screen.getByRole('button', { name: 'Completar' }))
      expect(await screen.findByText(/Sin conexión: esta acción necesita internet/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Deshacer' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Completar' })).toBeInTheDocument() // la cita no cambió
      expect(puts).toHaveLength(0)
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    }
  })

  it('«Cancelar» no pide confirmación: avisa con «Deshacer» y cancela de verdad pasados unos segundos', async () => {
    cancelDelay.ms = 1500
    const puts = mockAgenda([apt('a1')], { appointment: 'turno', appointments: 'turnos', customer: 'clienta' })
    const confirm = vi.spyOn(window, 'confirm')
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(confirm).not.toHaveBeenCalled()
    expect(await screen.findByText('Turno cancelado')).toBeInTheDocument()
    expect(puts).toHaveLength(0) // todavía no se envió nada
    await waitFor(() => expect(puts).toHaveLength(1), { timeout: 8000 })
    expect(puts[0].body).toEqual({ status: 'CANCELLED' })
  })

  it('«Deshacer» tras cancelar evita que se cancele y no avisa a nadie', async () => {
    cancelDelay.ms = 1500
    const puts = mockAgenda([apt('a1')])
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
    await user.click(await screen.findByRole('button', { name: 'Deshacer' }))
    await new Promise((r) => setTimeout(r, 2000))
    expect(puts).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument() // la cita sigue activa
  })

  it('«Deshacer» tras completar devuelve la cita a su estado anterior', async () => {
    const puts = mockAgenda([apt('a1')])
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: 'Completar' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0].body).toEqual({ status: 'COMPLETED' })
    await user.click(await screen.findByRole('button', { name: 'Deshacer' }))
    await waitFor(() => expect(puts).toHaveLength(2))
    expect(puts[1].body).toEqual({ status: 'SCHEDULED' })
  })

  it('una cita ya completada no ofrece acciones de estado', async () => {
    mockAgenda([apt('a1', { status: 'COMPLETED' })])
    open()
    const card = (await screen.findByText('Carlos Méndez')).closest('.p-5') as HTMLElement
    expect(within(card).queryByRole('button', { name: 'Completar' })).not.toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
  })

  it('en escritorio, una cita vigente ofrece WhatsApp con el enlace y «Copiar enlace»', async () => {
    mockAgenda([apt('a1', { cancelToken: 'tok-abc', client: { id: 'c1', name: 'Carlos Méndez', phone: '+53 5 555 1234' } })])
    const user = userEvent.setup()
    const writes: string[] = []
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => { writes.push(t) } }, configurable: true })
    open()
    const card = (await screen.findByText('Carlos Méndez')).closest('.p-5') as HTMLElement
    const wa = within(card).getByRole('link', { name: /WhatsApp/ })
    expect(wa).toHaveAttribute('href', expect.stringContaining('https://wa.me/5355551234?text='))
    expect(decodeURIComponent(wa.getAttribute('href') ?? '')).toContain(`${window.location.origin}/barberia-demo/mi-cita/tok-abc`)
    await user.click(within(card).getByRole('button', { name: /Copiar enlace/ }))
    await waitFor(() => expect(writes).toEqual([`${window.location.origin}/barberia-demo/mi-cita/tok-abc`]))
  })

  it('en escritorio, sin teléfono no hay WhatsApp y una cita completada no lleva enlace', async () => {
    mockAgenda([apt('a1', { cancelToken: 'tok-1' }), apt('a2', { status: 'COMPLETED', cancelToken: 'tok-2', startTime: '12:00', endTime: '12:30', client: { id: 'c2', name: 'Luis Pérez', phone: '+53 5 555 9999' } })])
    open()
    const sinTelefono = (await screen.findByText('Carlos Méndez')).closest('.p-5') as HTMLElement
    expect(within(sinTelefono).queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument()
    expect(within(sinTelefono).getByRole('button', { name: /Copiar enlace/ })).toBeInTheDocument()
    const completada = (await screen.findByText('Luis Pérez')).closest('.p-5') as HTMLElement
    expect(within(completada).getByRole('link', { name: /WhatsApp/ })).toBeInTheDocument()
    expect(within(completada).queryByRole('button', { name: /Copiar enlace/ })).not.toBeInTheDocument()
    expect(decodeURIComponent(within(completada).getByRole('link', { name: /WhatsApp/ }).getAttribute('href') ?? '')).not.toContain('mi-cita')
  })

  it('el selector Día/Semana cambia a la agenda semanal y vuelve', async () => {
    mockAgenda([apt('a1')])
    const user = userEvent.setup()
    open()
    await screen.findByText('Carlos Méndez')
    await user.click(screen.getByRole('button', { name: 'Semana' }))
    expect(await screen.findByText(/Arrastra un bloque para cambiar su día u hora/)).toBeInTheDocument()
    // «Día» también existe en la barra del calendario semanal: el primero es el selector de la página
    await user.click(screen.getAllByRole('button', { name: 'Día' })[0])
    expect(await screen.findByText('Carlos Méndez')).toBeInTheDocument()
  })

  it('la cita del papel lleva 📝 en el día y en la semana; en el formulario avisa de su origen', async () => {
    mockAgenda([apt('a1', { source: 'PAPEL' }), apt('a2', { startTime: '12:00', endTime: '12:30', client: { id: 'c2', name: 'Luis Pérez' } })])
    const user = userEvent.setup()
    open()
    const card = (await screen.findByText('Carlos Méndez')).closest('.p-5') as HTMLElement
    expect(within(card).getByRole('img', { name: 'Anotada desde papel' })).toBeInTheDocument()
    expect(within((await screen.findByText('Luis Pérez')).closest('.p-5') as HTMLElement).queryByRole('img', { name: 'Anotada desde papel' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Semana' }))
    expect(await screen.findAllByRole('img', { name: 'Anotada desde papel' })).toHaveLength(1)
  })

  it('«Viene del papel» solo aparece al crear y se envía como origen PAPEL', async () => {
    mockAgenda([])
    const posts: Array<Record<string, unknown>> = []
    server.use(
      http.get(`${API}/services`, () => HttpResponse.json([{ id: 's1', name: 'Corte de cabello', status: 'ACTIVE', price: 500, currency: 'CUP', durationMinutes: 30 }])),
      http.get(`${API}/appointments/available-slots`, () => HttpResponse.json([{ startTime: '15:00', professionalIds: ['p1'] }])),
      http.post(`${API}/appointments`, async ({ request }) => {
        posts.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(apt('nuevo'), { status: 201 })
      }),
    )
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: /Nueva cita/ }))
    const dialog = await screen.findByRole('dialog')
    await user.selectOptions(within(dialog).getByLabelText(/Cliente/), 'c1')
    await user.selectOptions(within(dialog).getByLabelText(/Servicio/), 's1')
    await user.selectOptions(await within(dialog).findByLabelText(/Hora/), '15:00')
    await user.click(within(dialog).getByRole('checkbox', { name: /Viene del papel/ }))
    await user.click(within(dialog).getByRole('button', { name: /^Guardar cita$/ }))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toMatchObject({ clientId: 'c1', serviceId: 's1', startTime: '15:00', source: 'PAPEL' })
  })

  it('al editar una cita normal no se ofrece «Viene del papel»', async () => {
    mockAgenda([apt('a1')])
    const user = userEvent.setup()
    open()
    await screen.findByText('Carlos Méndez')
    await user.click(screen.getByRole('button', { name: /Editar cita/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('checkbox', { name: /Viene del papel/ })).not.toBeInTheDocument()
  })

  it('«Gestionar horario» ofrece «Cupos extra» a quien reserva por cupos y avisa que la excepción general es para quien reserva por hora', async () => {
    mockAgenda([])
    localStorage.setItem('hasSession', '1')
    server.use(
      http.post(`${API}/auth/refresh`, () => HttpResponse.json({ user: { id: 'u1', email: 'dueno@demo.com', name: 'Yoel', role: 'OWNER', tenantId: 't1' }, token: 'tok' })),
      http.get(`${API}/professionals`, () => HttpResponse.json([
        { id: 'p1', name: 'Yoel', isActive: true, color: '#ec4899', bookingMode: 'TIMED' },
        { id: 'p2', name: 'Yumi', isActive: true, color: '#0f766e', bookingMode: 'QUOTA', quotaSlots: [] },
      ])),
      http.get(`${API}/professionals/p2/quota-extras`, () => HttpResponse.json([])),
      http.get(`${API}/overrides/:date`, () => HttpResponse.json({ error: 'Sin excepción' }, { status: 404 })),
    )
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: /Gestionar Horario de este Día/ }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByRole('region', { name: 'Cupos de Yumi' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('region', { name: 'Cupos de Yoel' })).not.toBeInTheDocument() // el de por hora no tiene cupos
    expect(within(dialog).getByText(/Para quien reserva por cupos usa «Cupos extra»/)).toBeInTheDocument()
  })
})
