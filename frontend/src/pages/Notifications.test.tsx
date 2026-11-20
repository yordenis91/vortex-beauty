import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import Notifications from './Notifications'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'
import { panelSettings } from '../test/fixtures'

const n = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  type: 'EMAIL',
  recipient: 'marta@example.com',
  content: 'Confirmamos tu turno. Corte de cabello, lunes 19 de octubre, 09:30',
  status: 'SENT',
  isRead: true,
  errorLog: null,
  retryable: false,
  clientId: 'c1',
  client: { id: 'c1', name: 'Marta Pérez', email: 'marta@example.com' },
  createdAt: '2026-10-18T03:00:00.000Z',
  updatedAt: '2026-10-18T03:00:00.000Z',
  ...over,
})

type Query = Record<string, string>
const queries: Query[] = []

function mock(items: unknown[], { total = items.length, counts = { PENDING: 1, SENT: 2, FAILED: 1 }, labels = {} as Record<string, string> } = {}) {
  queries.length = 0
  server.use(
    http.get(`${API}/settings/booking`, () => HttpResponse.json(panelSettings(labels))),
    http.get(`${API}/notifications/log`, ({ request }) => {
      queries.push(Object.fromEntries(new URL(request.url).searchParams))
      const page = Number(new URL(request.url).searchParams.get('page') ?? 1)
      return HttpResponse.json({ items, total, page, pageSize: 25, counts })
    }),
  )
}

describe('Registro de envíos', () => {
  it('cuenta los envíos por estado con los totales del servidor', async () => {
    mock([n('1')], { counts: { PENDING: 3, SENT: 40, FAILED: 7 } })
    renderWithProviders(<Notifications />)
    expect(await screen.findByText('Registro de envíos')).toBeInTheDocument()
    const card = (label: string) => screen.getByRole('button', { name: new RegExp(label) })
    await waitFor(() => expect(within(card('Enviadas')).getByText('40')).toBeInTheDocument())
    expect(within(card('Pendientes')).getByText('3')).toBeInTheDocument()
    expect(within(card('Con error')).getByText('7')).toBeInTheDocument()
  })

  it('muestra canal, destinatario, cliente o «dueño o equipo», mensaje y estado', async () => {
    mock([n('1'), n('2', { type: 'TELEGRAM', recipient: '4242', client: null, clientId: null, status: 'FAILED', errorLog: 'Chat no encontrado', content: 'Recordatorio' })])
    renderWithProviders(<Notifications />)
    await screen.findByText('Marta Pérez')
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('Correo')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Enviado')).toBeInTheDocument()
    expect(within(rows[0]).getByText(/Confirmamos tu turno/)).toBeInTheDocument()
    expect(within(rows[1]).getByText('Telegram')).toBeInTheDocument()
    expect(within(rows[1]).getByText('4242')).toBeInTheDocument()
    expect(within(rows[0]).getByText('marta@example.com')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Dueño o equipo')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Error')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Chat no encontrado')).toBeInTheDocument()
  })

  it('pulsar un estado, o elegir canal y público, filtra en el servidor y vuelve a la primera página', async () => {
    mock([n('1')])
    renderWithProviders(<Notifications />)
    const user = userEvent.setup()
    await screen.findByText('Marta Pérez')
    expect(queries.at(-1)).toMatchObject({ page: '1', pageSize: '25' })

    await user.click(screen.getByRole('button', { name: /Con error/ }))
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ status: 'FAILED', page: '1' }))
    expect(screen.getByRole('button', { name: /Con error/ })).toHaveAttribute('aria-pressed', 'true')

    await user.selectOptions(screen.getByLabelText('Canal'), 'TELEGRAM')
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ status: 'FAILED', channel: 'TELEGRAM' }))
    await user.selectOptions(screen.getByLabelText('Para'), 'TEAM')
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ audience: 'TEAM' }))

    await user.click(screen.getByRole('button', { name: 'Quitar filtros' }))
    await waitFor(() => expect(queries.at(-1)).not.toHaveProperty('status'))
    expect(queries.at(-1)).not.toHaveProperty('channel')
  })

  it('pagina con Anterior y Siguiente', async () => {
    mock([n('1')], { total: 60 })
    renderWithProviders(<Notifications />)
    const user = userEvent.setup()
    expect(await screen.findByText('1–25 de 60')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ page: '2' }))
    expect(await screen.findByText('26–50 de 60')).toBeInTheDocument()
  })

  it('«Reintentar» solo sale en los fallidos reintentables y avisa del resultado', async () => {
    mock([n('1', { status: 'FAILED', retryable: true, errorLog: 'buzón lleno' }), n('2', { status: 'FAILED', retryable: false })])
    const retried: string[] = []
    server.use(
      http.post(`${API}/notifications/:id/retry`, ({ params }) => {
        retried.push(String(params.id))
        return HttpResponse.json({ result: 'sent' })
      }),
    )
    renderWithProviders(<Notifications />)
    const user = userEvent.setup()
    const buttons = await screen.findAllByRole('button', { name: /Reintentar envío/ })
    expect(buttons).toHaveLength(1)
    await user.click(buttons[0])
    await waitFor(() => expect(retried).toEqual(['1']))
  })

  it('sin envíos lo dice, distinguiendo si hay filtros', async () => {
    mock([], { total: 0 })
    renderWithProviders(<Notifications />)
    const user = userEvent.setup()
    expect(await screen.findByText('Aún no hay envíos')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Canal'), 'EMAIL')
    expect(await screen.findByText('Ningún envío coincide con estos filtros')).toBeInTheDocument()
  })

  it('si falla la carga lo dice', async () => {
    server.use(
      http.get(`${API}/settings/booking`, () => HttpResponse.json(panelSettings())),
      http.get(`${API}/notifications/log`, () => HttpResponse.json({ error: 'x' }, { status: 500 })),
    )
    renderWithProviders(<Notifications />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el registro de envíos')
  })

  it('usa el vocabulario del salón', async () => {
    mock([], { labels: { customers: 'clientas', customer: 'clienta' } })
    renderWithProviders(<Notifications />)
    expect(await screen.findByText(/mandó a clientas y al equipo/)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Clientas' })).toBeInTheDocument()
  })
})
