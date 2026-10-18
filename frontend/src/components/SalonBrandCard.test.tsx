import { describe, it, expect } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import SalonBrandCard from './SalonBrandCard'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'

const base = { name: 'Barbería Demo', slug: 'barberia-demo', currency: 'CUP', timezone: 'America/Havana', vertical: 'BARBER', slotIntervalMin: 30, minNoticeHours: 2, maxAdvanceDays: 60, cancelWindowHrs: 12, bookingEnabled: true, maxActivePerCustomer: 3, reminderHours: [24, 2], ownerAlerts: true, telegramConfigured: false, telegramChatId: '', telegramBotUsername: null, telegramOwnerCode: null, labels: {} }

function mockSettings(over: Record<string, unknown>) {
  const puts: Array<Record<string, unknown>> = []
  server.use(
    http.get(`${API}/settings/booking`, () => HttpResponse.json({ ...base, logoUrl: null, brandColor: null, ...over })),
    http.put(`${API}/settings/booking`, async ({ request }) => {
      puts.push((await request.json()) as Record<string, unknown>)
      return HttpResponse.json({ ...base, logoUrl: null, brandColor: null, ...over })
    }),
  )
  return puts
}

describe('Marca del salón (Ajustes)', () => {
  it('sin cambios no deja guardar; al elegir un color envía solo logo y color', async () => {
    const puts = mockSettings({})
    const user = userEvent.setup()
    renderWithProviders(<SalonBrandCard />)
    const save = await screen.findByRole('button', { name: 'Guardar marca' })
    expect(save).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Color #2F6FED' }))
    expect(save).toBeEnabled()
    await user.click(save)
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]).toEqual({ logoUrl: '', brandColor: '#2F6FED' })
  })

  it('«Quitar color» y «Quitar logo» envían cadenas vacías (el servidor los borra)', async () => {
    const puts = mockSettings({ logoUrl: 'data:image/png;base64,AAAA', brandColor: '#1F8A70' })
    const user = userEvent.setup()
    renderWithProviders(<SalonBrandCard />)
    await user.click(await screen.findByRole('button', { name: 'Quitar logo' }))
    await user.click(screen.getByRole('button', { name: 'Quitar color' }))
    await user.click(screen.getByRole('button', { name: 'Guardar marca' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]).toEqual({ logoUrl: '', brandColor: '' })
  })

  it('el color elegido a mano también se envía en mayúsculas', async () => {
    const puts = mockSettings({})
    renderWithProviders(<SalonBrandCard />)
    const picker = await screen.findByLabelText('Elegir otro color')
    fireEvent.change(picker, { target: { value: '#2a9d8f' } })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Guardar marca' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0].brandColor).toBe('#2A9D8F')
  })
})
