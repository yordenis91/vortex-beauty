import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import Billing from './Billing'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'

const plan = { id: 'p1', name: 'Pro', priceMonthly: 20, priceYearly: 200, currency: 'USD' }
const sub = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  status: 'ACTIVE',
  billingCycle: 'MONTHLY',
  currentPeriodEnd: '2030-05-20T00:00:00.000Z',
  trialEndsAt: null,
  gateway: 'manual',
  plan,
  ...over,
})
const mock = (body: object) => server.use(http.get(`${API}/billing/status`, () => HttpResponse.json(body)))

describe('Facturación', () => {
  it('sin plan asignado pide contactar a soporte', async () => {
    mock({ subscription: null, mercadoPagoConfigured: false })
    renderWithProviders(<Billing />)
    expect(await screen.findByText('Todavía no tienes un plan asignado. Contacta a soporte.')).toBeInTheDocument()
  })

  it('muestra el plan, su precio mensual, el estado y que lo gestiona la plataforma', async () => {
    mock({ subscription: sub(), mercadoPagoConfigured: false })
    renderWithProviders(<Billing />)
    expect(await screen.findByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Activa')).toBeInTheDocument()
    expect(screen.getByText('/mes')).toBeInTheDocument()
    expect(screen.getByText(/Gestionado manualmente/)).toBeInTheDocument()
    expect(screen.getByText(/cobro automático todavía no está disponible/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Conectar método de pago/ })).not.toBeInTheDocument()
  })

  it('un plan anual muestra el precio anual', async () => {
    mock({ subscription: sub({ billingCycle: 'YEARLY' }), mercadoPagoConfigured: false })
    renderWithProviders(<Billing />)
    expect(await screen.findByText('/año')).toBeInTheDocument()
  })

  it('en prueba muestra cuándo termina', async () => {
    mock({ subscription: sub({ status: 'TRIALING', trialEndsAt: '2030-04-01T12:00:00.000Z' }), mercadoPagoConfigured: false })
    renderWithProviders(<Billing />)
    expect(await screen.findByText('En periodo de prueba')).toBeInTheDocument()
    expect(screen.getByText('La prueba termina el')).toBeInTheDocument()
  })

  it('con pasarela disponible ofrece conectar el método de pago', async () => {
    mock({ subscription: sub({ status: 'PAST_DUE' }), mercadoPagoConfigured: true })
    renderWithProviders(<Billing />)
    expect(await screen.findByText('Pago pendiente')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Conectar método de pago/ })).toBeInTheDocument()
  })
})
