import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import ManageBooking from './ManageBooking'
import { renderPage } from '../../test/render'
import { server, API } from '../../test/server'
import { manageView, SLUG } from '../../test/fixtures'

const BASE = `${API}/public/booking/${SLUG}/manage/tok`
const open = () => renderPage(<ManageBooking />, { path: '/:tenantSlug/mi-cita/:token', route: `/${SLUG}/mi-cita/tok` })

describe('Gestionar mi reserva (enlace secreto)', () => {
  it('muestra la reserva con su estado y permite cambiarla o cancelarla', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(manageView())))
    open()
    expect(await screen.findByText('Corte de cabello')).toBeInTheDocument()
    expect(screen.getByText('Confirmada')).toBeInTheDocument()
    expect(screen.getByText(/10:00–10:30/)).toBeInTheDocument()
    expect(screen.getByText('Con Yoel')).toBeInTheDocument()
    expect(screen.getByText('500 CUP')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cambiar fecha u hora' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeEnabled()
  })

  it('un enlace inválido o vencido lo explica', async () => {
    server.use(http.get(BASE, () => HttpResponse.json({ error: 'No encontrado' }, { status: 404 })))
    open()
    expect(await screen.findByText(/no es válido o ya venció/)).toBeInTheDocument()
  })

  it('dentro del plazo de cancelación bloquea los botones y explica por qué', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(manageView({ canCancel: false }))))
    open()
    expect(await screen.findByText(/hasta 12 horas antes/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cambiar fecha u hora' })).toBeDisabled()
  })

  it('cancelar pide confirmación y, al aceptar, deja la reserva como cancelada', async () => {
    let cancelled = 0
    server.use(
      http.get(BASE, () => HttpResponse.json(manageView())),
      http.post(`${BASE}/cancel`, () => {
        cancelled++
        return HttpResponse.json(manageView({ status: 'CANCELLED', canCancel: false }))
      }),
    )
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: 'Cancelar reserva' }))
    expect(screen.getByText('¿Seguro que quieres cancelar esta reserva?')).toBeInTheDocument()

    // «No, mantenerla» no cancela
    await user.click(screen.getByRole('button', { name: 'No, mantenerla' }))
    expect(cancelled).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Cancelar reserva' }))
    await user.click(screen.getByRole('button', { name: 'Sí, cancelar' }))
    expect(await screen.findByText('Cancelada')).toBeInTheDocument()
    expect(cancelled).toBe(1)
    expect(screen.queryByRole('button', { name: 'Cancelar reserva' })).not.toBeInTheDocument()
  })

  it('si el servidor rechaza la cancelación, muestra el motivo y no cambia el estado', async () => {
    server.use(
      http.get(BASE, () => HttpResponse.json(manageView())),
      http.post(`${BASE}/cancel`, () => HttpResponse.json({ error: 'Ya no se puede cancelar: faltan menos de 12 horas' }, { status: 409 })),
    )
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: 'Cancelar reserva' }))
    await user.click(screen.getByRole('button', { name: 'Sí, cancelar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('faltan menos de 12 horas')
    expect(screen.getByText('Confirmada')).toBeInTheDocument()
  })

  it('cambiar de hora: elige día y hora nuevos y muestra la reserva actualizada', async () => {
    const bodies: unknown[] = []
    const moved = manageView()
    moved.appointment.startTime = '11:30'
    moved.appointment.endTime = '12:00'
    server.use(
      http.get(BASE, () => HttpResponse.json(manageView())),
      http.get(`${BASE}/availability`, () => HttpResponse.json({ slots: [{ startTime: '11:30' }, { startTime: '12:00' }] })),
      http.post(`${BASE}/reschedule`, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(moved)
      }),
    )
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: 'Cambiar fecha u hora' }))
    expect(await screen.findByText('Elige el nuevo día y hora')).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('td[data-day] button:not([disabled])')).not.toBeNull())
    const day = document.querySelector<HTMLButtonElement>('td[data-day] button:not([disabled])')!
    const iso = day.closest('td')!.getAttribute('data-day')!
    await user.click(day)
    await user.click(await screen.findByRole('button', { name: '11:30' }))
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).toEqual({ date: iso, startTime: '11:30' })
    expect(await screen.findByText(/11:30–12:00/)).toBeInTheDocument()
  })

  it('ofrece activar Telegram, y si ya está activo lo confirma', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(manageView({ telegram: { botUsername: 'b_bot', linked: false, deepLink: 'https://t.me/b_bot?start=tok' } }))))
    const first = open()
    expect(await screen.findByRole('link', { name: /Recibir avisos por Telegram/ })).toHaveAttribute('href', 'https://t.me/b_bot?start=tok')
    first.unmount()

    server.use(http.get(BASE, () => HttpResponse.json(manageView({ telegram: { botUsername: 'b_bot', linked: true, deepLink: 'https://t.me/b_bot?start=tok' } }))))
    open()
    expect(await screen.findByText(/Recibirás tus avisos por Telegram/)).toBeInTheDocument()
  })

  it('una reserva cancelada no ofrece Telegram ni acciones', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(manageView({ status: 'CANCELLED', canCancel: false, telegram: { botUsername: 'b_bot', linked: false, deepLink: 'https://t.me/x' } }))))
    open()
    expect(await screen.findByText('Cancelada')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Telegram/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar reserva' })).not.toBeInTheDocument()
  })
})
