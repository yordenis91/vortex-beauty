import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import Dashboard from './Dashboard'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'

// El panel compara contra la fecha UTC de hoy (así lo calcula la pantalla).
const todayUtc = new Date().toISOString().split('T')[0]
const addDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().split('T')[0]

const settings = (labels: Record<string, string>) => ({
  name: 'Barbería Demo',
  slug: 'barberia-demo',
  currency: 'CUP',
  timezone: 'America/Havana',
  vertical: 'BARBER',
  labels,
})

const apt = (id: string, over: Record<string, unknown>) => ({
  id,
  date: `${todayUtc}T00:00:00.000Z`,
  startTime: '10:00',
  endTime: '10:30',
  startsAt: `${todayUtc}T14:00:00.000Z`,
  endsAt: `${todayUtc}T14:30:00.000Z`,
  status: 'SCHEDULED',
  serviceName: 'Corte de cabello',
  priceAmount: '500',
  currency: 'CUP',
  durationMin: 30,
  clientId: 'c1',
  serviceId: 's1',
  client: { id: 'c1', name: 'Carlos Méndez' },
  ...over,
})

function mockPanel(labels: Record<string, string>, appointments: unknown[], clients: unknown[] = [{ id: 'c1' }, { id: 'c2' }]) {
  server.use(
    http.get(`${API}/settings/booking`, () => HttpResponse.json(settings(labels))),
    http.get(`${API}/appointments`, () => HttpResponse.json(appointments)),
    http.get(`${API}/clients`, () => HttpResponse.json(clients)),
  )
}

const card = (name: string) => screen.getByText(name).closest('div')!.parentElement!

describe('Panel de control', () => {
  it('cuenta las citas de hoy, programadas y completadas, y los clientes', async () => {
    mockPanel({}, [
      apt('a1', {}),
      apt('a2', { date: `${addDays(2)}T00:00:00.000Z`, client: { id: 'c2', name: 'Luis Pérez' }, startTime: '11:00' }),
      apt('a3', { status: 'COMPLETED' }),
      apt('a4', { status: 'CANCELLED' }),
    ])
    renderWithProviders(<Dashboard />)
    expect(await screen.findByText('Citas de hoy')).toBeInTheDocument()
    expect(within(card('Citas de hoy')).getByText('1')).toBeInTheDocument()
    expect(within(card('Citas programadas')).getByText('2')).toBeInTheDocument()
    expect(within(card('Citas completadas')).getByText('1')).toBeInTheDocument()
    expect(within(card('Clientes')).getByText('2')).toBeInTheDocument()
  })

  it('lista las próximas, ordenadas como llegan, solo las programadas', async () => {
    mockPanel({}, [apt('a1', {}), apt('a2', { client: { id: 'c2', name: 'Luis Pérez' }, startTime: '11:00' }), apt('a3', { status: 'CANCELLED', client: { id: 'c3', name: 'Cancelado' } })])
    renderWithProviders(<Dashboard />)
    expect(await screen.findByText('Carlos Méndez')).toBeInTheDocument()
    expect(screen.getByText('Luis Pérez')).toBeInTheDocument()
    expect(screen.queryByText('Cancelado')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver agenda/ })).toHaveAttribute('href', '/admin/appointments')
  })

  it('con el vocabulario de una barbería habla de turnos y concuerda el género', async () => {
    mockPanel({ appointment: 'turno', appointments: 'turnos', customer: 'cliente', customers: 'clientes' }, [apt('a1', {}), apt('a3', { status: 'COMPLETED' })])
    renderWithProviders(<Dashboard />)
    expect(await screen.findByText('Turnos de hoy')).toBeInTheDocument()
    expect(screen.getByText('Turnos programados')).toBeInTheDocument()
    expect(screen.getByText('Turnos completados')).toBeInTheDocument()
    expect(screen.getByText('Próximos turnos')).toBeInTheDocument()
  })

  it('con «sesiones» (femenino) concuerda: programadas, completadas, próximas', async () => {
    mockPanel({ appointment: 'sesión', appointments: 'sesiones', customer: 'cliente', customers: 'clientes' }, [apt('a1', {})])
    renderWithProviders(<Dashboard />)
    expect(await screen.findByText('Sesiones programadas')).toBeInTheDocument()
    expect(screen.getByText('Sesiones completadas')).toBeInTheDocument()
    expect(screen.getByText('Próximas sesiones')).toBeInTheDocument()
  })

  it('sin citas próximas lo dice con el vocabulario del salón', async () => {
    mockPanel({ appointment: 'turno', appointments: 'turnos' }, [])
    renderWithProviders(<Dashboard />)
    expect(await screen.findByText('No hay turnos próximos.')).toBeInTheDocument()
  })

  it('una clienta (vocabulario de manicura) aparece como «Clientas»', async () => {
    mockPanel({ customer: 'clienta', customers: 'clientas', appointment: 'cita', appointments: 'citas' }, [])
    renderWithProviders(<Dashboard />)
    expect(await screen.findByText('Clientas')).toBeInTheDocument()
  })
})
