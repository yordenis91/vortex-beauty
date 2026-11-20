import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes, useLocation } from 'react-router-dom'
import ActivityBell from './ActivityBell'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'
import { panelSettings } from '../test/fixtures'

const now = Date.now()
const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString()

const event = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  kind: 'CREATED',
  appointmentId: 'a1',
  actor: 'CUSTOMER',
  source: 'PUBLIC',
  clientName: 'Ana López',
  serviceName: 'Corte',
  professionalName: 'Carlos',
  startsAt: '2031-03-03T15:00:00.000Z',
  previousStartsAt: null,
  createdAt: iso(5),
  unread: true,
  ...over,
})

function mock(items: Array<Record<string, unknown>>, unread = items.filter((e) => e.unread).length) {
  const seen: unknown[] = []
  server.use(
    http.get(`${API}/settings/booking`, () => HttpResponse.json(panelSettings())),
    // Tras marcar como visto, el servidor deja de contar lo anterior.
    http.get(`${API}/activity`, () =>
      HttpResponse.json(seen.length ? { items: items.map((e) => ({ ...e, unread: false })), unread: 0, nextCursor: null } : { items, unread, nextCursor: null }),
    ),
    http.post(`${API}/activity/seen`, async ({ request }) => {
      seen.push(await request.json())
      return HttpResponse.json({ seenAt: new Date().toISOString() })
    }),
  )
  return seen
}

const Where = () => {
  const l = useLocation()
  return <p data-testid="where">{l.pathname + l.search}</p>
}

const open = () =>
  renderWithProviders(
    <Routes>
      <Route path="*" element={<><ActivityBell /><Where /></>} />
    </Routes>,
  )

describe('campanita de novedades de reservas', () => {
  it('muestra el número de novedades sin ver en la campanita', async () => {
    mock([event(), event({ id: 'e2' })])
    open()
    expect(await screen.findByRole('button', { name: 'Novedades de reservas, 2 sin ver' })).toBeInTheDocument()
  })

  it('sin novedades por ver no hay globo, y el panel lo explica', async () => {
    mock([])
    open()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Novedades de reservas' }))
    expect(await screen.findByText(/Aún no hay novedades/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Marcar todo como visto' })).toBeDisabled()
  })

  it('lista cada tipo de novedad con su texto, la hora del salón y la hora anterior si cambió', async () => {
    mock([
      event({ id: 'n', clientName: 'Ana López' }),
      event({ id: 'c', kind: 'RESCHEDULED', clientName: 'Luisa Gil', previousStartsAt: '2031-03-03T14:00:00.000Z', startsAt: '2031-03-03T16:00:00.000Z' }),
      event({ id: 'x', kind: 'CANCELLED', clientName: 'Rosa Paz', unread: false }),
      event({ id: 'p', clientName: 'Marta Ruiz', actor: 'STAFF', source: 'PAPEL', unread: false }),
    ])
    open()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Novedades de reservas/ }))

    expect(await screen.findByText('Ana López reservó')).toBeInTheDocument()
    expect(screen.getByText('Luisa Gil cambió su cita')).toBeInTheDocument()
    expect(screen.getByText('Rosa Paz canceló su cita')).toBeInTheDocument()
    expect(screen.getByText('Se agendó a Marta Ruiz (del papel)')).toBeInTheDocument()
    // 15:00 UTC = 10:00 en La Habana (UTC-5 en marzo de 2031 antes del cambio de hora)
    expect(screen.getAllByText(/^lun 3 mar · \d{2}:\d{2}$/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Corte · Carlos').length).toBeGreaterThan(0)
    expect(screen.getByText(/^Antes: lun 3 mar · \d{2}:\d{2}$/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Hoy' })).toBeInTheDocument()
  })

  it('cerrar el panel marca como vistas las novedades hasta la más reciente', async () => {
    const newest = iso(1)
    const seen = mock([event({ createdAt: newest }), event({ id: 'e2', createdAt: iso(30) })])
    open()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /sin ver/ }))
    await screen.findAllByText('Ana López reservó')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(seen).toHaveLength(1))
    expect(seen[0]).toEqual({ upTo: newest })
  })

  it('«Marcar todo como visto» lo hace sin cerrar el panel', async () => {
    const seen = mock([event()])
    open()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /sin ver/ }))
    await user.click(await screen.findByRole('button', { name: 'Marcar todo como visto' }))
    await waitFor(() => expect(seen).toHaveLength(1))
    expect(await screen.findByRole('button', { name: 'Novedades de reservas' })).toBeInTheDocument()
  })

  it('pulsar una novedad lleva a ese día de la agenda con la cita enfocada', async () => {
    mock([event()])
    open()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /sin ver/ }))
    await user.click(await screen.findByRole('button', { name: /Ana López reservó/ }))
    expect(screen.getByTestId('where').textContent).toMatch(/^\/admin\/appointments\?fecha=\d{4}-\d{2}-\d{2}&cita=a1$/)
  })

  it('una cancelación lleva al día pero sin enfocar la cita', async () => {
    mock([event({ kind: 'CANCELLED', id: 'x' })])
    open()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /sin ver/ }))
    await user.click(await screen.findByRole('button', { name: /canceló su cita/ }))
    expect(screen.getByTestId('where').textContent).toMatch(/^\/admin\/appointments\?fecha=\d{4}-\d{2}-\d{2}$/)
  })

  it('el sonido está apagado por defecto y el interruptor lo recuerda', async () => {
    mock([])
    open()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Novedades de reservas' }))
    const toggle = await screen.findByRole('button', { name: 'Activar el sonido de avisos' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Silenciar el sonido de avisos' })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('afilao:bell-sound')).toBe('1')
  })

  it('pone el número en el título de la pestaña y lo quita al no haber novedades', async () => {
    document.title = 'Afilao'
    mock([event(), event({ id: 'e2' })])
    const view = open()
    await waitFor(() => expect(document.title).toBe('(2) Afilao'))
    view.unmount()
    expect(document.title).toBe('Afilao')
  })

  it('si falla la carga lo dice sin romper la barra', async () => {
    server.use(
      http.get(`${API}/settings/booking`, () => HttpResponse.json(panelSettings())),
      http.get(`${API}/activity`, () => HttpResponse.json({ error: 'x' }, { status: 500 })),
    )
    open()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Novedades de reservas' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las novedades')
  })
})
