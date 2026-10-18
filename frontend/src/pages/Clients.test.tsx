import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import Clients from './Clients'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'
import { client, panelSettings } from '../test/fixtures'

function mock(clients: unknown[], labels: Record<string, string> = {}) {
  const calls: Array<{ method: string; url: string; body?: Record<string, unknown> }> = []
  server.use(
    http.get(`${API}/settings/booking`, () => HttpResponse.json(panelSettings(labels))),
    http.get(`${API}/clients`, () => HttpResponse.json(clients)),
    http.post(`${API}/clients`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.push({ method: 'POST', url: '/clients', body })
      return HttpResponse.json(client({ id: 'new', ...body }), { status: 201 })
    }),
    http.delete(`${API}/clients/:id`, ({ params }) => {
      calls.push({ method: 'DELETE', url: `/clients/${params.id}` })
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

describe('Clientes', () => {
  it('lista los clientes con su inicial y correo', async () => {
    mock([client(), client({ id: 'c2', name: 'Luis Pérez', email: 'luis@example.com' })])
    renderWithProviders(<Clients />)
    expect(await screen.findByText('Carlos Méndez')).toBeInTheDocument()
    expect(screen.getByText('carlos@example.com')).toBeInTheDocument()
    expect(screen.getByText('Luis Pérez')).toBeInTheDocument()
  })

  it('sin clientes lo dice con el vocabulario del salón', async () => {
    mock([], { customer: 'clienta', customers: 'clientas' })
    renderWithProviders(<Clients />)
    expect(await screen.findByText('No se encontraron clientas.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nueva clienta/ })).toBeInTheDocument()
    expect(screen.getByText('Gestiona tu cartera de clientas')).toBeInTheDocument()
  })

  it('con vocabulario masculino el botón dice «Nuevo cliente»', async () => {
    mock([client()])
    renderWithProviders(<Clients />)
    expect(await screen.findByRole('button', { name: /Nuevo cliente/ })).toBeInTheDocument()
  })

  it('la búsqueda filtra por nombre o correo', async () => {
    mock([client(), client({ id: 'c2', name: 'Luis Pérez', email: 'luis@example.com' })])
    const user = userEvent.setup()
    renderWithProviders(<Clients />)
    await screen.findByText('Carlos Méndez')
    await user.type(screen.getByPlaceholderText('Buscar por nombre o email...'), 'luis@')
    expect(screen.queryByText('Carlos Méndez')).not.toBeInTheDocument()
    expect(screen.getByText('Luis Pérez')).toBeInTheDocument()
  })

  it('crea un cliente con nombre, correo y teléfono', async () => {
    const calls = mock([client()])
    const user = userEvent.setup()
    renderWithProviders(<Clients />)
    await screen.findByText('Carlos Méndez')
    await user.click(screen.getByRole('button', { name: /Nuevo cliente/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText('Ej: María García'), 'Raúl Gómez')
    await user.type(within(dialog).getByPlaceholderText('maria@example.com'), 'raul@example.com')
    await user.type(within(dialog).getByPlaceholderText('+53 5 555 1234'), '+53 5 555 7777')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body).toMatchObject({ name: 'Raúl Gómez', email: 'raul@example.com', phone: '+53 5 555 7777' })
  })

  it('eliminar pide confirmación y no borra al cancelar', async () => {
    const calls = mock([client()])
    const user = userEvent.setup()
    renderWithProviders(<Clients />)
    await screen.findByText('Carlos Méndez')
    const card = screen.getByText('Carlos Méndez').closest('.flex-col') as HTMLElement
    await user.click(within(card).getAllByRole('button').at(-1)!)
    expect(await screen.findByText('¿Estás seguro de que quieres eliminar el cliente? Esta acción no se puede deshacer.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(calls).toHaveLength(0)
    await user.click(within(screen.getByText('Carlos Méndez').closest('.flex-col') as HTMLElement).getAllByRole('button').at(-1)!)
    await user.click(await screen.findByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(calls).toEqual([{ method: 'DELETE', url: '/clients/cli1' }]))
  })
})
