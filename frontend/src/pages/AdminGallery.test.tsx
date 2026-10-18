import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import AdminGallery from './AdminGallery'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'
import { service } from '../test/fixtures'

const item = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: 'Degradado clásico',
  imageUrl: 'data:image/png;base64,iVBORw0KGgo=',
  isActive: true,
  serviceId: 'srv1',
  service: service(),
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...over,
})

function mock(items: unknown[]) {
  const calls: Array<{ method: string; url: string; body?: unknown }> = []
  server.use(
    http.get(`${API}/services`, () => HttpResponse.json([service()])),
    http.get(`${API}/gallery/admin`, () => HttpResponse.json(items)),
    http.put(`${API}/gallery/:id`, async ({ params, request }) => {
      calls.push({ method: 'PUT', url: `/gallery/${params.id}`, body: await request.json() })
      return HttpResponse.json({})
    }),
    http.delete(`${API}/gallery/:id`, ({ params }) => {
      calls.push({ method: 'DELETE', url: `/gallery/${params.id}` })
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

describe('Galería (administración)', () => {
  it('lista los diseños con su servicio, precio y estado', async () => {
    mock([item('g1'), item('g2', { title: 'Barba perfilada', isActive: false })])
    renderWithProviders(<AdminGallery />)
    expect(await screen.findByText('Degradado clásico')).toBeInTheDocument()
    expect(screen.getAllByText('Servicio: Corte de cabello')).toHaveLength(2)
    expect(screen.getAllByText('Precio: 500 CUP')).toHaveLength(2)
    expect(screen.getByText('Estado: Activo')).toBeInTheDocument()
    expect(screen.getByText('Estado: Inactivo')).toBeInTheDocument()
  })

  it('sin diseños lo dice', async () => {
    mock([])
    renderWithProviders(<AdminGallery />)
    expect(await screen.findByText('No hay diseños registrados aún.')).toBeInTheDocument()
  })

  it('activar o desactivar cambia solo ese diseño', async () => {
    const calls = mock([item('g1'), item('g2', { title: 'Barba perfilada', isActive: false })])
    const user = userEvent.setup()
    renderWithProviders(<AdminGallery />)
    await user.click(await screen.findByRole('button', { name: 'Desactivar' }))
    await user.click(screen.getByRole('button', { name: 'Activar' }))
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(calls).toEqual([
      { method: 'PUT', url: '/gallery/g1', body: { isActive: false } },
      { method: 'PUT', url: '/gallery/g2', body: { isActive: true } },
    ])
  })

  it('eliminar pide confirmación nombrando el diseño', async () => {
    const calls = mock([item('g1')])
    const user = userEvent.setup()
    renderWithProviders(<AdminGallery />)
    const card = (await screen.findByText('Degradado clásico')).closest('.border') as HTMLElement
    await user.click(within(card).getByRole('button', { name: 'Eliminar' }))
    expect(await screen.findByText(/eliminar el diseño de inspiración 'Degradado clásico'/)).toBeInTheDocument()
    expect(calls).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(calls).toHaveLength(0)
    await user.click(within(card).getByRole('button', { name: 'Eliminar' }))
    await user.click(screen.getAllByRole('button', { name: 'Eliminar' }).at(-1)!)
    await waitFor(() => expect(calls).toEqual([{ method: 'DELETE', url: '/gallery/g1' }]))
  })
})
