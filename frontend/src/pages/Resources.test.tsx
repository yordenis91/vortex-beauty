import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import Resources from './Resources'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'

const mock = (resources: unknown[]) => {
  const calls: Array<{ method: string; url: string; body?: unknown }> = []
  server.use(
    http.get(`${API}/resources`, () => HttpResponse.json(resources)),
    http.post(`${API}/resources`, async ({ request }) => {
      const body = await request.json()
      calls.push({ method: 'POST', url: '/resources', body })
      return HttpResponse.json({ id: 'new', isActive: true, ...(body as object) }, { status: 201 })
    }),
    http.put(`${API}/resources/:id`, async ({ params, request }) => {
      calls.push({ method: 'PUT', url: `/resources/${params.id}`, body: await request.json() })
      return HttpResponse.json({})
    }),
    http.delete(`${API}/resources/:id`, ({ params }) => {
      calls.push({ method: 'DELETE', url: `/resources/${params.id}` })
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

describe('Recursos (sillas, cabinas...)', () => {
  it('lista los recursos con cuántos servicios los usan y marca los inactivos', async () => {
    mock([
      { id: 'r1', name: 'Silla 1', isActive: true, serviceIds: ['a', 'b'] },
      { id: 'r2', name: 'Silla 2', isActive: false, serviceIds: [] },
    ])
    renderWithProviders(<Resources />)
    expect(await screen.findByText('Silla 1')).toBeInTheDocument()
    expect(screen.getByText('2 servicios lo usan')).toBeInTheDocument()
    expect(screen.getByText('(inactivo)')).toBeInTheDocument()
  })

  it('sin recursos explica que no es obligatorio crear ninguno', async () => {
    mock([])
    renderWithProviders(<Resources />)
    expect(await screen.findByText(/no necesitas crear ninguno/)).toBeInTheDocument()
  })

  it('crea un recurso con el nombre escrito y vacía el campo', async () => {
    const calls = mock([])
    const user = userEvent.setup()
    renderWithProviders(<Resources />)
    const input = await screen.findByPlaceholderText(/Nombre \(ej\./)
    await user.type(input, '  Cabina 3 ')
    await user.click(screen.getByRole('button', { name: /Agregar/ }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]).toMatchObject({ method: 'POST', body: { name: 'Cabina 3' } })
    await waitFor(() => expect(input).toHaveValue(''))
  })

  it('no envía un nombre vacío', async () => {
    const calls = mock([])
    const user = userEvent.setup()
    renderWithProviders(<Resources />)
    await user.click(await screen.findByRole('button', { name: /Agregar/ }))
    expect(calls).toHaveLength(0)
  })

  it('activar o desactivar envía el cambio', async () => {
    const calls = mock([{ id: 'r1', name: 'Silla 1', isActive: true, serviceIds: [] }])
    const user = userEvent.setup()
    renderWithProviders(<Resources />)
    await user.click(await screen.findByRole('checkbox', { name: 'Activo' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]).toEqual({ method: 'PUT', url: '/resources/r1', body: { isActive: false } })
  })

  it('eliminar pide confirmación antes de borrar', async () => {
    const calls = mock([{ id: 'r1', name: 'Silla 1', isActive: true, serviceIds: [] }])
    const user = userEvent.setup()
    renderWithProviders(<Resources />)
    await user.click(await screen.findByRole('button', { name: 'Eliminar' }))
    expect(screen.getByText('¿Seguro que quieres eliminar este recurso?')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(calls).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    await user.click(screen.getAllByRole('button', { name: 'Eliminar' }).at(-1)!)
    await waitFor(() => expect(calls).toEqual([{ method: 'DELETE', url: '/resources/r1' }]))
  })
})
