import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
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
  clientId: 'c1',
  client: { id: 'c1', name: 'Marta Pérez', email: 'marta@example.com' },
  createdAt: '2026-10-18T03:00:00.000Z',
  updatedAt: '2026-10-18T03:00:00.000Z',
  ...over,
})

const mock = (list: unknown[], labels: Record<string, string> = {}) =>
  server.use(
    http.get(`${API}/settings/booking`, () => HttpResponse.json(panelSettings(labels))),
    http.get(`${API}/notifications`, () => HttpResponse.json(list)),
  )

describe('Centro de notificaciones', () => {
  it('cuenta los avisos por estado', async () => {
    mock([n('1'), n('2'), n('3', { status: 'FAILED' }), n('4', { status: 'PENDING', type: 'TELEGRAM', recipient: '4242' })])
    renderWithProviders(<Notifications />)
    expect(await screen.findByText('Centro de Notificaciones')).toBeInTheDocument()
    const stat = (label: string) => screen.getByText(label).parentElement!
    await waitFor(() => expect(within(stat('Total')).getByText('4')).toBeInTheDocument())
    expect(within(stat('Enviadas')).getByText('2')).toBeInTheDocument()
    expect(within(stat('Pendientes')).getByText('1')).toBeInTheDocument()
    expect(within(stat('Errores')).getByText('1')).toBeInTheDocument()
  })

  it('muestra canal, destinatario, cliente, mensaje y estado de cada aviso', async () => {
    mock([n('1'), n('2', { type: 'TELEGRAM', recipient: '4242', client: null, status: 'FAILED', content: 'Recordatorio' })])
    renderWithProviders(<Notifications />)
    await screen.findByText('Marta Pérez')
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('Email')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Enviado')).toBeInTheDocument()
    expect(within(rows[0]).getByText(/Confirmamos tu turno/)).toBeInTheDocument()
    expect(within(rows[1]).getByText('Telegram')).toBeInTheDocument()
    expect(within(rows[1]).getByText('4242')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Error')).toBeInTheDocument()
    expect(within(rows[1]).getByText('-')).toBeInTheDocument() // aviso al dueño, sin cliente
  })

  it('sin avisos lo dice', async () => {
    mock([])
    renderWithProviders(<Notifications />)
    expect(await screen.findByText('No hay notificaciones')).toBeInTheDocument()
  })

  it('la nota menciona Telegram (no WhatsApp, que no se usa) y el vocabulario del salón', async () => {
    mock([], { customers: 'clientas', customer: 'clienta' })
    renderWithProviders(<Notifications />)
    expect(await screen.findByText(/enviadas a las clientas incluidas Telegram, Email/)).toBeInTheDocument()
  })
})
