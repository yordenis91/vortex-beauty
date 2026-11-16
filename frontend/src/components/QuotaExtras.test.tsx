import { describe, it, expect, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import toast, { Toaster } from 'react-hot-toast'
import QuotaExtras from './QuotaExtras'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'
import type { Professional } from '../types'

// 2030-02-04 es lunes (getDay() = 1)
const DATE = '2030-02-04'
const pro = {
  id: 'p1', name: 'Yumi', isActive: true, acceptsOnlineBookings: true, bookingMode: 'QUOTA', createdAt: '', updatedAt: '',
  quotaSlots: [{ dayOfWeek: 1, time: '11:00' }, { dayOfWeek: 1, time: '09:00' }, { dayOfWeek: 3, time: '15:00' }],
} as Professional

function mock(initial: Array<{ id: string; date: string; time: string }> = []) {
  let extras = [...initial]
  const posts: Array<Record<string, unknown>> = []
  const deletes: string[] = []
  server.use(
    http.get(`${API}/professionals/p1/quota-extras`, () => HttpResponse.json(extras)),
    http.post(`${API}/professionals/p1/quota-extras`, async ({ request }) => {
      const body = (await request.json()) as { date: string; time: string }
      posts.push(body)
      if (body.time === '09:00') return HttpResponse.json({ error: 'Esa hora ya es uno de sus cupos de ese día.' }, { status: 409 })
      const created = { id: `x${posts.length}`, ...body }
      extras = [...extras, created]
      return HttpResponse.json(created, { status: 201 })
    }),
    http.delete(`${API}/professionals/p1/quota-extras/:id`, ({ params }) => {
      deletes.push(String(params.id))
      extras = extras.filter((x) => x.id !== params.id)
      return HttpResponse.json({ message: 'ok' })
    }),
  )
  return { posts, deletes }
}

afterEach(() => toast.remove())

describe('Cupos extra de un día', () => {
  it('muestra los cupos de siempre de ese día de la semana, ordenados, y los extra aparte', async () => {
    mock([{ id: 'x0', date: DATE, time: '16:00' }])
    renderWithProviders(<QuotaExtras professional={pro} date={DATE} />)
    expect(await screen.findByText('16:00')).toBeInTheDocument()
    const region = screen.getByRole('region', { name: 'Cupos de Yumi' })
    expect(region).toHaveTextContent(/09:00\s*11:00/)
    expect(region).not.toHaveTextContent('15:00') // ese cupo es de los miércoles
  })

  it('agrega un cupo extra y aparece en la lista', async () => {
    const { posts } = mock()
    const user = userEvent.setup()
    renderWithProviders(<QuotaExtras professional={pro} date={DATE} />)
    await user.type(screen.getByLabelText('Hora del cupo extra de Yumi'), '16:30')
    await user.click(screen.getByRole('button', { name: /Agregar cupo extra/ }))
    await waitFor(() => expect(posts).toEqual([{ date: DATE, time: '16:30' }]))
    expect(await screen.findByRole('button', { name: 'Quitar el cupo extra de las 16:30 de Yumi' })).toBeInTheDocument()
  })

  it('no envía nada sin hora y muestra el motivo si el servidor lo rechaza', async () => {
    const { posts } = mock()
    const user = userEvent.setup()
    renderWithProviders(<><Toaster /><QuotaExtras professional={pro} date={DATE} /></>)
    await user.click(screen.getByRole('button', { name: /Agregar cupo extra/ }))
    expect(await screen.findByText('Elige la hora del cupo extra.')).toBeInTheDocument()
    expect(posts).toHaveLength(0)
    await user.type(screen.getByLabelText('Hora del cupo extra de Yumi'), '09:00')
    await user.click(screen.getByRole('button', { name: /Agregar cupo extra/ }))
    expect(await screen.findByText('Esa hora ya es uno de sus cupos de ese día.')).toBeInTheDocument()
  })

  it('quita un cupo extra', async () => {
    const { deletes } = mock([{ id: 'x0', date: DATE, time: '16:00' }])
    const user = userEvent.setup()
    renderWithProviders(<QuotaExtras professional={pro} date={DATE} />)
    await user.click(await screen.findByRole('button', { name: 'Quitar el cupo extra de las 16:00 de Yumi' }))
    await waitFor(() => expect(deletes).toEqual(['x0']))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Quitar el cupo extra/ })).not.toBeInTheDocument())
  })
})
