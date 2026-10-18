import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import Categories from './Categories'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'
import { category } from '../test/fixtures'

function mock(categories: unknown[]) {
  const calls: Array<{ method: string; url: string; body?: Record<string, unknown> }> = []
  server.use(
    http.get(`${API}/categories`, () => HttpResponse.json(categories)),
    http.post(`${API}/categories`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.push({ method: 'POST', url: '/categories', body })
      return HttpResponse.json(category({ id: 'new', ...body }), { status: 201 })
    }),
    http.delete(`${API}/categories/:id`, ({ params }) => {
      calls.push({ method: 'DELETE', url: `/categories/${params.id}` })
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

describe('Categorías', () => {
  it('lista las categorías con su descripción, y el texto de ayuda ya no habla de módulos que no existen', async () => {
    mock([category(), category({ id: 'c2', name: 'Barba', description: undefined })])
    renderWithProviders(<Categories />)
    expect(await screen.findByText('Cortes')).toBeInTheDocument()
    expect(screen.getByText('Cortes de cabello')).toBeInTheDocument()
    expect(screen.getByText('Barba')).toBeInTheDocument()
    expect(screen.queryByText(/base de conocimiento/i)).not.toBeInTheDocument()
  })

  it('sin categorías invita a crear la primera, todo en español', async () => {
    mock([])
    renderWithProviders(<Categories />)
    expect(await screen.findByText('Aún no hay categorías')).toBeInTheDocument()
    expect(screen.queryByText(/Add Category|No categories|Get started/)).not.toBeInTheDocument()
  })

  it('la búsqueda filtra por nombre', async () => {
    mock([category(), category({ id: 'c2', name: 'Barba' })])
    const user = userEvent.setup()
    renderWithProviders(<Categories />)
    await screen.findByText('Cortes')
    await user.type(screen.getByPlaceholderText('Buscar categorías...'), 'bar')
    expect(screen.queryByText('Cortes')).not.toBeInTheDocument()
    expect(screen.getByText('Barba')).toBeInTheDocument()
  })

  it('crea una categoría con nombre y descripción', async () => {
    const calls = mock([category()])
    const user = userEvent.setup()
    renderWithProviders(<Categories />)
    await screen.findByText('Cortes')
    await user.click(screen.getByRole('button', { name: /Agregar categoría/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText('Nombre de la categoría'), 'Tintes')
    await user.type(within(dialog).getByPlaceholderText('Descripción de la categoría'), 'Color completo')
    await user.click(within(dialog).getByRole('button', { name: /Crear Categoría/ }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body).toMatchObject({ name: 'Tintes', description: 'Color completo' })
  })

  it('eliminar pide confirmación', async () => {
    const calls = mock([category()])
    const user = userEvent.setup()
    renderWithProviders(<Categories />)
    await screen.findByText('Cortes')
    const card = screen.getByText('Cortes').closest('.p-6') as HTMLElement
    await user.click(within(card).getAllByRole('button').at(-1)!)
    expect(await screen.findByText(/Esta acción no se puede deshacer/)).toBeInTheDocument()
    expect(calls).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(calls).toEqual([{ method: 'DELETE', url: '/categories/cat1' }]))
  })
})
