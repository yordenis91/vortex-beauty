import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import Plans from './Plans'
import { renderWithProviders } from '../../test/render'
import { server, API } from '../../test/server'

const P = `${API}/platform`

const plan = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: 'Pro',
  slug: 'pro',
  description: 'Para barberías con equipo',
  priceMonthly: '12',
  priceYearly: '120',
  currency: 'USD',
  trialDays: 30,
  maxStaff: 10,
  maxAppointmentsPerMonth: null,
  maxLocations: null,
  features: ['Avisos por Telegram'],
  isActive: true,
  isPublic: true,
  sortOrder: 0,
  _count: { tenantSubscriptions: 3 },
  ...over,
})

function mock(plans: unknown[]) {
  const deleted: string[] = []
  server.use(
    http.get(`${P}/plans`, () => HttpResponse.json(plans)),
    http.delete(`${P}/plans/:id`, ({ params }) => {
      deleted.push(String(params.id))
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return deleted
}

describe('Super Admin · Planes', () => {
  it('muestra cada plan con precios, prueba, límites y funciones', async () => {
    mock([plan('p1'), plan('p2', { name: 'Free', priceMonthly: '0', priceYearly: '0', maxStaff: 1, isActive: false, trialDays: 0, features: [], _count: { tenantSubscriptions: 0 } })])
    renderWithProviders(<Plans />)
    expect(await screen.findByText('Pro')).toBeInTheDocument()
    expect(screen.getByText((_, el) => el?.tagName === 'DIV' && el.textContent === '$12/mes')).toBeInTheDocument()
    expect(screen.getByText(/\$120\/año · 30 días de prueba/)).toBeInTheDocument()
    expect(screen.getByText('10 profesionales')).toBeInTheDocument()
    expect(screen.getAllByText('Ilimitadas citas/mes').length).toBeGreaterThan(0)
    expect(screen.getByText('Avisos por Telegram')).toBeInTheDocument()
    expect(screen.getByText(/Activo · 3 salón\(es\)/)).toBeInTheDocument()
    expect(screen.getByText(/Inactivo/)).toBeInTheDocument()
  })

  it('sin planes lo dice', async () => {
    mock([])
    renderWithProviders(<Plans />)
    expect(await screen.findByText('No hay planes todavía.')).toBeInTheDocument()
  })

  it('«Nuevo Plan» abre el formulario de creación', async () => {
    mock([plan('p1')])
    const user = userEvent.setup()
    renderWithProviders(<Plans />)
    await user.click(await screen.findByRole('button', { name: /Nuevo Plan/ }))
    expect(await screen.findByText('Crear Nuevo Plan')).toBeInTheDocument()
  })

  it('eliminar un plan pide confirmación', async () => {
    const deleted = mock([plan('p1')])
    const user = userEvent.setup()
    renderWithProviders(<Plans />)
    await screen.findByText('Pro')
    const buttons = screen.getAllByRole('button')
    const trash = buttons.find((b) => b.querySelector('svg.lucide-trash2, svg.lucide-trash-2'))!
    await user.click(trash)
    expect(await screen.findByText(/eliminar este plan/)).toBeInTheDocument()
    expect(deleted).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(deleted).toEqual(['p1']))
  })
})
