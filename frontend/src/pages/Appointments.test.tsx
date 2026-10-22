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
    renderWithProviders(
      <AuthProvider>
        <Appointments />
      </AuthProvider>,
      { route: `/admin/appointments?fecha=${today}&cita=a1` },
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Editar cita/)).toBeInTheDocument()
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
})
