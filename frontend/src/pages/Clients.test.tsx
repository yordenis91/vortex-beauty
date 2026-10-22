import { describe, it, expect } from 'vitest'
import { Toaster } from 'react-hot-toast'
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
    await user.type(screen.getByPlaceholderText('Buscar clientes...'), 'luis@')
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
    expect(Object.keys(calls[0].body!)).not.toEqual(expect.arrayContaining(['username']))
    expect(calls[0].body).not.toHaveProperty('password')
  })

  it('permite crear un cliente solo con teléfono: el correo es opcional', async () => {
    const calls = mock([client()])
    const user = userEvent.setup()
    renderWithProviders(<Clients />)
    await screen.findByText('Carlos Méndez')
    await user.click(screen.getByRole('button', { name: /Nuevo cliente/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByPlaceholderText('maria@example.com')).not.toBeRequired()
    await user.type(within(dialog).getByPlaceholderText('Ej: María García'), 'Marta Solo Teléfono')
    await user.type(within(dialog).getByPlaceholderText('+53 5 555 1234'), '+53 5 555 0000')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body).toMatchObject({ name: 'Marta Solo Teléfono', email: '', phone: '+53 5 555 0000' })
  })

  it('si el cliente tiene citas, el servidor rechaza el borrado y la ficha sigue en la lista', async () => {
    mock([client()])
    const deletes: string[] = []
    server.use(
      http.delete(`${API}/clients/:id`, ({ params }) => {
        deletes.push(String(params.id))
        return HttpResponse.json({ error: 'Este cliente tiene 2 citas registradas. Para no perder tu historial, no se puede eliminar.', appointments: 2 }, { status: 409 })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<Clients />)
    await screen.findByText('Carlos Méndez')
    await user.click(screen.getAllByRole('button', { name: 'Eliminar' })[0])
    await screen.findByText('¿Estás seguro de que quieres eliminar el cliente? Esta acción no se puede deshacer.')
    await user.click(screen.getAllByRole('button', { name: 'Eliminar' }).at(-1)!)
    await waitFor(() => expect(deletes).toHaveLength(1))
    expect(screen.getByText('Carlos Méndez')).toBeInTheDocument()
  })

  it('archivar saca al cliente de la lista, avisa con «Deshacer» y deshacer lo restaura', async () => {
    const posts: string[] = []
    const archived: string[] = []
    server.use(
      http.get(`${API}/settings/booking`, () => HttpResponse.json(panelSettings())),
      http.get(`${API}/clients`, ({ request }) => HttpResponse.json(new URL(request.url).searchParams.get('archived') ? archived.map((id) => client({ id, name: 'Carlos Méndez' })) : archived.length ? [] : [client()])),
      http.post(`${API}/clients/:id/:action`, ({ params }) => {
        posts.push(`${params.action}:${params.id}`)
        if (params.action === 'archive') archived.push(String(params.id))
        else archived.splice(0)
        return HttpResponse.json(client({ id: String(params.id) }))
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<><Toaster /><Clients /></>)
    await screen.findByText('Carlos Méndez')
    await user.click(screen.getByRole('button', { name: 'Archivar' }))
    expect(await screen.findByText('Carlos Méndez archivado')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Archivar' })).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(() => expect(posts).toEqual(['archive:cli1', 'restore:cli1']))
    expect(await screen.findByText('Carlos Méndez')).toBeInTheDocument()
  })

  it('la vista «Archivados» lista a los archivados y permite restaurarlos', async () => {
    const posts: string[] = []
    server.use(
      http.get(`${API}/settings/booking`, () => HttpResponse.json(panelSettings())),
      http.get(`${API}/clients`, ({ request }) => HttpResponse.json(new URL(request.url).searchParams.get('archived') ? [client({ name: 'Marta Antigua' })] : [client()])),
      http.post(`${API}/clients/:id/:action`, ({ params }) => {
        posts.push(`${params.action}:${params.id}`)
        return HttpResponse.json(client())
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<Clients />)
    await screen.findByText('Carlos Méndez')
    await user.click(screen.getByRole('button', { name: 'Archivados' }))
    expect(await screen.findByText('Marta Antigua')).toBeInTheDocument()
    expect(screen.queryByText('Carlos Méndez')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Restaurar' }))
    await waitFor(() => expect(posts).toEqual(['restore:cli1']))
  })

  it('sin archivados lo dice', async () => {
    server.use(
      http.get(`${API}/settings/booking`, () => HttpResponse.json(panelSettings())),
      http.get(`${API}/clients`, ({ request }) => HttpResponse.json(new URL(request.url).searchParams.get('archived') ? [] : [client()])),
    )
    const user = userEvent.setup()
    renderWithProviders(<Clients />)
    await screen.findByText('Carlos Méndez')
    await user.click(screen.getByRole('button', { name: 'Archivados' }))
    expect(await screen.findByText('No tienes clientes archivados.')).toBeInTheDocument()
  })

  it('si llegas desde el buscador (?buscar=) el nombre ya está escrito y la lista filtrada', async () => {
    mock([client(), client({ id: 'c2', name: 'Luis Pérez', email: 'luis@example.com' })])
    renderWithProviders(<Clients />, { route: '/admin/clients?buscar=Luis' })
    expect(await screen.findByDisplayValue('Luis')).toBeInTheDocument()
    expect(screen.getByText('Luis Pérez')).toBeInTheDocument()
    expect(screen.queryByText('Carlos Méndez')).not.toBeInTheDocument()
  })

  it('sin teléfono ni correo no se envía el formulario', async () => {
    const calls = mock([client()])
    const user = userEvent.setup()
    renderWithProviders(<Clients />)
    await screen.findByText('Carlos Méndez')
    await user.click(screen.getByRole('button', { name: /Nuevo cliente/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText('Ej: María García'), 'Sin contacto')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await new Promise((r) => setTimeout(r, 150))
    expect(calls).toHaveLength(0)
    expect(screen.getByRole('dialog')).toBeInTheDocument() // el formulario sigue abierto
  })

  it('el formulario de nuevo cliente no ofrece credenciales de acceso (los clientes no tienen portal)', async () => {
    mock([client()])
    const user = userEvent.setup()
    renderWithProviders(<Clients />)
    await screen.findByText('Carlos Méndez')
    await user.click(screen.getByRole('button', { name: /Nuevo cliente/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByText('Credenciales de Acceso')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Contraseña')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Enviar correo de bienvenida')).not.toBeInTheDocument()
    expect(within(dialog).queryByPlaceholderText('nombre_usuario')).not.toBeInTheDocument()
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
