import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import Services from './Services'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'
import { category, panelSettings, professional, service } from '../test/fixtures'

function mock(services: unknown[], settings = panelSettings()) {
  const calls: Array<{ method: string; url: string; body?: Record<string, unknown> }> = []
  server.use(
    http.get(`${API}/settings/booking`, () => HttpResponse.json(settings)),
    http.get(`${API}/services`, () => HttpResponse.json(services)),
    http.get(`${API}/categories`, () => HttpResponse.json([category(), category({ id: 'cat2', name: 'Barba' })])),
    http.get(`${API}/professionals`, () => HttpResponse.json([professional()])),
    http.get(`${API}/resources`, () => HttpResponse.json([])),
    http.post(`${API}/services`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.push({ method: 'POST', url: '/services', body })
      return HttpResponse.json(service({ id: 'new', ...body }), { status: 201 })
    }),
    http.delete(`${API}/services/:id`, ({ params }) => {
      calls.push({ method: 'DELETE', url: `/services/${params.id}` })
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

describe('Servicios', () => {
  it('lista cada servicio con categoría, precio, duración y visibilidad', async () => {
    mock([service(), service({ id: 's2', name: 'Barba', price: '300', durationMinutes: 20, isPublic: false, category: category({ id: 'cat2', name: 'Barba' }), description: undefined })])
    renderWithProviders(<Services />)
    expect(await screen.findByText('Corte de cabello')).toBeInTheDocument()
    expect(screen.getByText('500 CUP')).toBeInTheDocument()
    expect(screen.getByText('30 min')).toBeInTheDocument()
    expect(screen.getByText('Visible')).toBeInTheDocument()
    expect(screen.getByText('Oculto')).toBeInTheDocument()
    expect(screen.getByText('Clásico')).toBeInTheDocument()
  })

  it('sin servicios invita a crear el primero', async () => {
    mock([])
    renderWithProviders(<Services />)
    expect(await screen.findByText('Sin servicios')).toBeInTheDocument()
  })

  it('la búsqueda filtra por nombre o descripción', async () => {
    mock([service(), service({ id: 's2', name: 'Arreglo de barba', description: 'Con navaja' })])
    const user = userEvent.setup()
    renderWithProviders(<Services />)
    await screen.findByText('Corte de cabello')
    await user.type(screen.getByPlaceholderText('Buscar servicios...'), 'navaja')
    expect(screen.queryByText('Corte de cabello')).not.toBeInTheDocument()
    expect(screen.getByText('Arreglo de barba')).toBeInTheDocument()
  })

  it('un servicio nuevo nace en la moneda del salón y con la duración indicada', async () => {
    const calls = mock([service()], panelSettings({}, { currency: 'CUP' }))
    const user = userEvent.setup()
    renderWithProviders(<Services />)
    await screen.findByText('Corte de cabello')
    await user.click(screen.getByRole('button', { name: /Agregar servicio/ }))
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(within(dialog).getAllByRole('option').length).toBeGreaterThan(1))
    const [name] = within(dialog).getAllByRole('textbox')
    const [price, duration] = within(dialog).getAllByRole('spinbutton')
    await user.type(name, 'Corte infantil')
    await user.type(price, '350')
    await user.clear(duration)
    await user.type(duration, '25')
    await user.selectOptions(within(dialog).getAllByRole('combobox')[0], 'cat1')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body).toMatchObject({ name: 'Corte infantil', price: 350, currency: 'CUP', categoryId: 'cat1', durationMinutes: 25 })
  })

  it('eliminar pide confirmación', async () => {
    const calls = mock([service()])
    const user = userEvent.setup()
    renderWithProviders(<Services />)
    await user.click(await screen.findByRole('button', { name: 'Eliminar' }))
    expect(await screen.findByText('¿Seguro que quieres eliminar este servicio?')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
    await user.click(screen.getAllByRole('button', { name: 'Eliminar' }).at(-1)!)
    await waitFor(() => expect(calls).toEqual([{ method: 'DELETE', url: '/services/srv1' }]))
  })

  it('usa el vocabulario del salón en la descripción', async () => {
    mock([], panelSettings({ customers: 'clientas', customer: 'clienta' }))
    renderWithProviders(<Services />)
    expect(await screen.findByText('Los servicios que las clientas pueden reservar.')).toBeInTheDocument()
  })
})
