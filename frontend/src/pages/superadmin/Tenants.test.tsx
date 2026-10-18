import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import Tenants from './Tenants'
import { renderWithProviders } from '../../test/render'
import { server, API } from '../../test/server'

const P = `${API}/platform`

const tenant = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: 'Barbería Demo',
  slug: 'barberia-demo',
  currency: 'CUP',
  timezone: 'America/Havana',
  status: 'ACTIVE',
  createdAt: '2026-10-16T00:00:00.000Z',
  platformSubscription: null,
  users: [{ id: 'u1', email: 'dueno@demo.com', name: 'Dueño' }],
  _count: { clients: 6, staff: 2 },
  ...over,
})

function mock(tenants: unknown[], totalPages = 1) {
  const queries: Array<Record<string, string>> = []
  const patches: Array<{ id: string; body: unknown }> = []
  server.use(
    http.get(`${P}/plans`, () => HttpResponse.json([{ id: 'plan-pro', name: 'Pro', maxStaff: 10, features: [] }])),
    http.get(`${P}/tenants/templates`, () => HttpResponse.json({ templates: {}, hours: [] })),
    http.get(`${P}/tenants`, ({ request }) => {
      queries.push(Object.fromEntries(new URL(request.url).searchParams))
      return HttpResponse.json({ data: tenants, pagination: { page: Number(queries.at(-1)!.page), pageSize: 20, total: tenants.length, totalPages } })
    }),
    http.patch(`${P}/tenants/:id/status`, async ({ params, request }) => {
      patches.push({ id: String(params.id), body: await request.json() })
      return HttpResponse.json({})
    }),
  )
  return { queries, patches }
}

describe('Super Admin · Salones', () => {
  it('lista los salones con dueño, estado y datos (la lista móvil y la tabla comparten datos)', async () => {
    mock([tenant('t1'), tenant('t2', { name: 'Manicura Demo', slug: 'manicura-demo', status: 'SUSPENDED', users: [{ id: 'u2', email: 'ana@demo.com', name: 'Ana' }] })])
    renderWithProviders(<Tenants />)
    expect((await screen.findAllByText('Barbería Demo')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('dueno@demo.com').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Activo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Suspendido').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Ver detalle/ })[0]).toHaveAttribute('href', '/superadmin/tenants/t1')
  })

  it('sin resultados muestra un mensaje', async () => {
    mock([])
    renderWithProviders(<Tenants />)
    expect(await screen.findByText(/No se encontraron salones con estos filtros/)).toBeInTheDocument()
  })

  it('los filtros viajan al servidor y vuelven a la página 1', async () => {
    const { queries } = mock([tenant('t1')])
    const user = userEvent.setup()
    renderWithProviders(<Tenants />)
    await screen.findAllByText('Barbería Demo')
    await user.selectOptions(screen.getByDisplayValue('Todos los estados'), 'SUSPENDED')
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ status: 'SUSPENDED', page: '1' }))
    await user.selectOptions(await screen.findByDisplayValue('Todos los planes'), 'plan-pro')
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ status: 'SUSPENDED', planId: 'plan-pro' }))
    await user.type(screen.getByPlaceholderText(/Buscar por nombre/), 'demo')
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ search: 'demo' }))
  })

  it('suspender un salón envía el cambio de estado', async () => {
    const { patches } = mock([tenant('t1')])
    const user = userEvent.setup()
    renderWithProviders(<Tenants />)
    await user.click((await screen.findAllByRole('button', { name: 'Cambiar estado' }))[0])
    await user.click(await screen.findByRole('menuitem', { name: 'Suspender' }))
    await waitFor(() => expect(patches).toEqual([{ id: 't1', body: { status: 'SUSPENDED' } }]))
  })

  it('«Nuevo Salón» abre el asistente de alta', async () => {
    mock([tenant('t1')])
    const user = userEvent.setup()
    renderWithProviders(<Tenants />)
    await user.click(await screen.findByRole('button', { name: /Nuevo Salón/ }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Nuevo salón')
    expect(screen.getByPlaceholderText('Barbería El Elegante')).toBeInTheDocument()
  })
})
