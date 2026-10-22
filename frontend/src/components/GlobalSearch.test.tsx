import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes, useLocation } from 'react-router-dom'
import GlobalSearch from './GlobalSearch'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'
import { ymd } from '../test/fixtures'
import { addDays } from 'date-fns'

const user = (role: string) => ({ id: 'u1', email: 'dueno@demo.com', name: 'Yoel', role, tenantId: 't1' })
const tomorrow = ymd(addDays(new Date(), 1))

const apt = (id: string, over: Record<string, unknown> = {}) => ({
  id, date: `${tomorrow}T00:00:00.000Z`, startTime: '09:30', endTime: '10:30', status: 'SCHEDULED', serviceName: 'Uñas acrílicas',
  client: { id: 'c1', name: 'Yadira Castillo' }, ...over,
})

const Where = () => {
  const l = useLocation()
  return <p data-testid="ruta">{l.pathname + l.search}</p>
}
const Gate = () => {
  const { isLoading } = useAuth()
  return isLoading ? null : <GlobalSearch />
}

function open(role = 'OWNER') {
  localStorage.setItem('hasSession', '1')
  const calls: string[] = []
  server.use(
    http.post(`${API}/auth/refresh`, () => HttpResponse.json({ user: user(role), token: 'tok' })),
    http.get(`${API}/clients`, ({ request }) => {
      calls.push(`clients?${new URL(request.url).searchParams.get('search')}`)
      return HttpResponse.json([{ id: 'c1', name: 'Yadira Castillo', phone: '+53 5 555 2002', email: null }])
    }),
    http.get(`${API}/appointments`, ({ request }) => {
      calls.push(`appointments?${new URL(request.url).searchParams.get('q')}`)
      return HttpResponse.json([apt('a1')])
    }),
  )
  renderWithProviders(
    <AuthProvider>
      <Routes>
        <Route path="*" element={<><Gate /><Where /></>} />
      </Routes>
    </AuthProvider>,
  )
  return calls
}

describe('Buscador de la barra superior', () => {
  it('no busca con menos de dos letras', async () => {
    const calls = open()
    const user = userEvent.setup()
    await user.type(await screen.findByRole('combobox'), 'y')
    await new Promise((r) => setTimeout(r, 400))
    expect(calls).toEqual([])
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('el dueño encuentra clientes y citas, con sus detalles', async () => {
    const calls = open()
    const user = userEvent.setup()
    await user.type(await screen.findByRole('combobox'), 'yadi')
    const list = await screen.findByRole('listbox')
    const clients = await within(list).findByRole('group', { name: 'Clientes' })
    expect(within(clients).getByText('Yadira Castillo')).toBeInTheDocument()
    expect(within(clients).getByText('+53 5 555 2002')).toBeInTheDocument()
    const appointments = within(list).getByRole('group', { name: 'Citas' })
    expect(within(appointments).getByText('Yadira Castillo · Uñas acrílicas')).toBeInTheDocument()
    expect(calls).toEqual(['clients?yadi', 'appointments?yadi'])
  })

  it('al elegir un cliente lleva a Clientes con su nombre ya escrito', async () => {
    open()
    const user = userEvent.setup()
    await user.type(await screen.findByRole('combobox'), 'yadi')
    const clients = await screen.findByRole('group', { name: 'Clientes' })
    await user.click(within(clients).getByRole('option', { name: /Yadira Castillo/ }))
    expect(screen.getByTestId('ruta')).toHaveTextContent('/admin/clients?buscar=Yadira%20Castillo')
    expect(screen.getByRole('combobox')).toHaveValue('')
  })

  it('al elegir una cita lleva a su día y la abre', async () => {
    open()
    const user = userEvent.setup()
    await user.type(await screen.findByRole('combobox'), 'yadi')
    const appointments = await screen.findByRole('group', { name: 'Citas' })
    await user.click(within(appointments).getByRole('option'))
    expect(screen.getByTestId('ruta')).toHaveTextContent(`/admin/appointments?fecha=${tomorrow}&cita=a1`)
  })

  it('con el teclado: flecha abajo y Enter eligen la segunda opción', async () => {
    open()
    const user = userEvent.setup()
    await user.type(await screen.findByRole('combobox'), 'yadi')
    await screen.findByRole('group', { name: 'Citas' }) // esperar a los resultados
    await user.keyboard('{ArrowDown}{Enter}') // del cliente a la cita
    await waitFor(() => expect(screen.getByTestId('ruta')).toHaveTextContent('/admin/appointments?fecha='))
  })

  it('Escape cierra la lista sin borrar lo escrito', async () => {
    open()
    const user = userEvent.setup()
    const box = await screen.findByRole('combobox')
    await user.type(box, 'yadi')
    await screen.findByRole('listbox')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(box).toHaveValue('yadi')
  })

  it('un profesional solo busca citas, no clientes', async () => {
    const calls = open('STAFF')
    const user = userEvent.setup()
    const box = await screen.findByRole('combobox')
    expect(box).toHaveAttribute('placeholder', 'Buscar cita…')
    await user.type(box, 'yadi')
    await screen.findByRole('group', { name: 'Citas' })
    expect(screen.queryByRole('group', { name: 'Clientes' })).not.toBeInTheDocument()
    expect(calls).toEqual(['appointments?yadi'])
  })

  it('sin resultados lo dice', async () => {
    open()
    server.use(http.get(`${API}/clients`, () => HttpResponse.json([])), http.get(`${API}/appointments`, () => HttpResponse.json([])))
    const user = userEvent.setup()
    await user.type(await screen.findByRole('combobox'), 'zzz')
    expect(await screen.findByText('No encontré nada con ese texto.')).toBeInTheDocument()
  })
})
