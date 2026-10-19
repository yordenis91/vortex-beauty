import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import Team from './Team'
import { AuthProvider } from '../contexts/AuthContext'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'
import { panelSettings, professional } from '../test/fixtures'

const member = (over: Record<string, unknown> = {}) => ({
  id: 'u1', name: 'Luis', email: 'luis@x.com', role: 'ADMIN', isActive: true, createdAt: '2030-01-01T00:00:00Z', professional: null, ...over,
})

function mock(team: unknown[], pros: unknown[] = []) {
  const calls: Array<{ method: string; url: string; body?: unknown }> = []
  server.use(
    http.get(`${API}/settings/booking`, () => HttpResponse.json(panelSettings())),
    http.get(`${API}/team`, () => HttpResponse.json(team)),
    http.get(`${API}/professionals`, () => HttpResponse.json(pros)),
    http.post(`${API}/team`, async ({ request }) => {
      const body = await request.json()
      calls.push({ method: 'POST', url: '/team', body })
      return HttpResponse.json({ user: member({ id: 'n', name: 'Marta', email: 'marta@x.com' }), tempPassword: 'Abc23456xyZk' }, { status: 201 })
    }),
    http.post(`${API}/team/:id/reset-password`, ({ params }) => {
      calls.push({ method: 'POST', url: `/team/${params.id}/reset-password` })
      return HttpResponse.json({ tempPassword: 'NuevaTemp789' })
    }),
    http.patch(`${API}/team/:id`, async ({ params, request }) => {
      calls.push({ method: 'PATCH', url: `/team/${params.id}`, body: await request.json() })
      return HttpResponse.json(member())
    }),
  )
  return calls
}

describe('Equipo', () => {
  it('lista a las personas con su tipo de acceso y estado', async () => {
    mock([member({ id: 'o', name: 'Dueña', role: 'OWNER' }), member(), member({ id: 'u2', name: 'Ana', role: 'STAFF', isActive: false })])
    renderWithProviders(<AuthProvider><Team /></AuthProvider>)
    expect(await screen.findByText('Luis')).toBeInTheDocument()
    expect(screen.getByText('Dueño')).toBeInTheDocument()
    expect(screen.getByText('Gerente')).toBeInTheDocument()
    expect(screen.getByText('Desactivado')).toBeInTheDocument()
    // la cuenta del dueño no tiene acciones: Luis y Ana sí
    expect(screen.getAllByRole('button', { name: /Restablecer contraseña/ })).toHaveLength(2)
  })

  it('crea un gerente y muestra la contraseña temporal una vez', async () => {
    const calls = mock([member({ id: 'o', name: 'Dueña', role: 'OWNER' })])
    const user = userEvent.setup()
    renderWithProviders(<AuthProvider><Team /></AuthProvider>)
    await user.click(await screen.findByRole('button', { name: /Nuevo usuario/ }))
    await user.selectOptions(screen.getByLabelText('Tipo de acceso'), 'ADMIN')
    await user.type(screen.getByLabelText('Nombre'), 'Marta')
    await user.type(screen.getByLabelText('Correo'), 'marta@x.com')
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))
    expect(await screen.findByText(/Contraseña temporal: Abc23456xyZk/)).toBeInTheDocument()
    expect(calls[0].body).toEqual({ name: 'Marta', email: 'marta@x.com', role: 'ADMIN' })
  })

  it('un profesional se elige de las fichas que aún no tienen cuenta', async () => {
    const calls = mock(
      [member({ id: 'o', name: 'Dueña', role: 'OWNER' })],
      [professional({ id: 'p1', name: 'Yoel', email: 'yoel@x.com' }), professional({ id: 'p2', name: 'Raúl', user: { id: 'u9', email: 'r@x.com' } })],
    )
    const user = userEvent.setup()
    renderWithProviders(<AuthProvider><Team /></AuthProvider>)
    await user.click(await screen.findByRole('button', { name: /Nuevo usuario/ }))
    const select = await screen.findByLabelText(/^Profesional$/)
    expect(screen.queryByRole('option', { name: 'Raúl' })).not.toBeInTheDocument()
    await user.selectOptions(select, 'p1')
    // nombre y correo se rellenan desde la ficha
    expect(screen.getByLabelText('Nombre')).toHaveValue('Yoel')
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))
    await waitFor(() => expect(calls[0].body).toEqual({ name: 'Yoel', email: 'yoel@x.com', role: 'STAFF', professionalId: 'p1' }))
  })

  it('restablece la contraseña y desactiva a una persona', async () => {
    const calls = mock([member({ id: 'o', name: 'Dueña', role: 'OWNER' }), member()])
    const user = userEvent.setup()
    renderWithProviders(<AuthProvider><Team /></AuthProvider>)
    await user.click(await screen.findByRole('button', { name: /Restablecer contraseña/ }))
    expect(await screen.findByText(/Contraseña temporal: NuevaTemp789/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    await user.click(screen.getByRole('button', { name: /Desactivar/ }))
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH' && (c.body as { isActive: boolean }).isActive === false)).toBe(true))
  })
})
