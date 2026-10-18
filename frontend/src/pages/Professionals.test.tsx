import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import Professionals from './Professionals'
import { AuthProvider } from '../contexts/AuthContext'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'
import { panelSettings, professional, service } from '../test/fixtures'

function mock(pros: unknown[], labels: Record<string, string> = {}) {
  const calls: Array<{ method: string; url: string; body?: Record<string, unknown> }> = []
  server.use(
    http.get(`${API}/settings/booking`, () => HttpResponse.json(panelSettings(labels))),
    http.get(`${API}/professionals`, () => HttpResponse.json(pros)),
    http.get(`${API}/services`, () => HttpResponse.json([service()])),
    http.post(`${API}/professionals`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.push({ method: 'POST', url: '/professionals', body })
      return HttpResponse.json(professional({ id: 'new', ...body }), { status: 201 })
    }),
    http.delete(`${API}/professionals/:id`, ({ params }) => {
      calls.push({ method: 'DELETE', url: `/professionals/${params.id}` })
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

describe('Profesionales', () => {
  it('lista cada profesional con contacto, servicios y estado', async () => {
    mock([
      professional({ email: 'yoel@example.com', phone: '+53 5 555 0002' }),
      professional({ id: 'p2', name: 'Raúl', isActive: false, serviceIds: [], acceptsOnlineBookings: false, user: { id: 'u9', email: 'raul@example.com' } }),
    ])
    renderWithProviders(<AuthProvider><Professionals /></AuthProvider>)
    expect(await screen.findByText('Yoel')).toBeInTheDocument()
    expect(screen.getByText(/yoel@example.com · \+53 5 555 0002 · 1 servicios/)).toBeInTheDocument()
    expect(screen.getByText('(inactivo)')).toBeInTheDocument()
    expect(screen.getByText(/Sin contacto · 0 servicios · con acceso · sin reserva en línea/)).toBeInTheDocument()
  })

  it('en una barbería se llaman barberos', async () => {
    mock([professional()], { professional: 'barbero', professionals: 'barberos' })
    renderWithProviders(<AuthProvider><Professionals /></AuthProvider>)
    expect(await screen.findByRole('heading', { name: 'Barberos' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Buscar barberos...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Agregar barbero/i })).toBeInTheDocument()
  })

  it('sin profesionales muestra el estado vacío', async () => {
    mock([], { professionals: 'manicuristas' })
    renderWithProviders(<AuthProvider><Professionals /></AuthProvider>)
    expect(await screen.findByText('Sin manicuristas')).toBeInTheDocument()
  })

  it('crea un profesional con su nombre', async () => {
    const calls = mock([professional()])
    const user = userEvent.setup()
    renderWithProviders(<AuthProvider><Professionals /></AuthProvider>)
    await screen.findByText('Yoel')
    await user.click(screen.getByRole('button', { name: /Agregar profesional/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getAllByRole('textbox')[0], 'Nuevo Barbero')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body).toMatchObject({ name: 'Nuevo Barbero' })
  })

  it('eliminar pide confirmación y avisa que con citas conviene desactivar', async () => {
    const calls = mock([professional()])
    const user = userEvent.setup()
    renderWithProviders(<AuthProvider><Professionals /></AuthProvider>)
    await user.click(await screen.findByRole('button', { name: 'Eliminar' }))
    expect(await screen.findByText(/Si tiene citas registradas, desactívalo en su lugar/)).toBeInTheDocument()
    expect(calls).toHaveLength(0)
    await user.click(screen.getAllByRole('button', { name: 'Eliminar' }).at(-1)!)
    await waitFor(() => expect(calls).toEqual([{ method: 'DELETE', url: '/professionals/pro1' }]))
  })
})
