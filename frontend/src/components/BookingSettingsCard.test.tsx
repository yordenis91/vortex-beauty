import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import BookingSettingsCard from './BookingSettingsCard'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'

const settings = (over: Record<string, unknown> = {}) => ({
  name: 'Barbería Demo',
  slug: 'barberia-demo',
  currency: 'CUP',
  timezone: 'America/Havana',
  vertical: 'BARBER',
  slotIntervalMin: 30,
  minNoticeHours: 2,
  maxAdvanceDays: 60,
  cancelWindowHrs: 12,
  bookingEnabled: true,
  maxActivePerCustomer: 3,
  reminderHours: [24, 2],
  ownerAlerts: true,
  telegramConfigured: false,
  telegramChatId: '',
  telegramBotUsername: null,
  telegramOwnerCode: null,
  labels: { appointment: 'turno', appointments: 'turnos' },
  ...over,
})

function mockSettings(initial: Record<string, unknown>) {
  const puts: Array<Record<string, unknown>> = []
  server.use(
    http.get(`${API}/settings/booking`, () => HttpResponse.json(settings(initial))),
    http.put(`${API}/settings/booking`, async ({ request }) => {
      puts.push((await request.json()) as Record<string, unknown>)
      return HttpResponse.json(settings(initial))
    }),
  )
  return puts
}

afterEach(() => vi.restoreAllMocks())

describe('Ajustes de reservas y Telegram', () => {
  it('muestra el enlace corto de reservas del salón y su QR', async () => {
    mockSettings({})
    renderWithProviders(<BookingSettingsCard />)
    const link = await screen.findByDisplayValue(`${window.location.origin}/r/barberia-demo`)
    expect(link).toHaveAttribute('readonly')
    expect(await screen.findByRole('img', { name: 'Código QR de reservas' })).toBeInTheDocument()
  })

  it('sin bot: pide el token y lo envía al guardar', async () => {
    const puts = mockSettings({})
    const user = userEvent.setup()
    renderWithProviders(<BookingSettingsCard />)
    await user.type(await screen.findByPlaceholderText('123456:ABC...'), '123:TOKEN-DE-PRUEBA')
    await user.click(screen.getByRole('button', { name: 'Guardar ajustes' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]).toMatchObject({ telegramBotToken: '123:TOKEN-DE-PRUEBA', timezone: 'America/Havana', vertical: 'BARBER' })
  })

  it('sin tocar el token, guardar no lo envía (nunca se borra por accidente)', async () => {
    const puts = mockSettings({})
    const user = userEvent.setup()
    renderWithProviders(<BookingSettingsCard />)
    await screen.findByPlaceholderText('123456:ABC...')
    await user.click(screen.getByRole('button', { name: 'Guardar ajustes' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]).not.toHaveProperty('telegramBotToken')
  })

  it('con bot conectado y dueño sin enlazar, muestra el usuario del bot y el comando /vincular con su código', async () => {
    mockSettings({ telegramBotUsername: 'elegante_bot', telegramOwnerCode: 'A1B2C3D4', telegramConfigured: false })
    renderWithProviders(<BookingSettingsCard />)
    const bot = await screen.findByRole('link', { name: '@elegante_bot' })
    expect(bot).toHaveAttribute('href', 'https://t.me/elegante_bot')
    expect(screen.getByText('/vincular A1B2C3D4')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('123456:ABC...')).not.toBeInTheDocument()
  })

  it('con el dueño ya enlazado confirma que recibe los avisos y no repite el comando', async () => {
    mockSettings({ telegramBotUsername: 'elegante_bot', telegramOwnerCode: 'A1B2C3D4', telegramConfigured: true, telegramChatId: '9001' })
    renderWithProviders(<BookingSettingsCard />)
    expect(await screen.findByText(/Recibes aquí los avisos/)).toBeInTheDocument()
    expect(screen.queryByText(/\/vincular/)).not.toBeInTheDocument()
  })

  it('desconectar el bot pide confirmación y envía el token vacío', async () => {
    const puts = mockSettings({ telegramBotUsername: 'elegante_bot', telegramOwnerCode: 'A1B2C3D4' })
    const confirm = vi.spyOn(window, 'confirm')
    const user = userEvent.setup()
    renderWithProviders(<BookingSettingsCard />)

    confirm.mockReturnValueOnce(false)
    await user.click(await screen.findByRole('button', { name: 'Desconectar bot' }))
    expect(puts).toHaveLength(0)

    confirm.mockReturnValueOnce(true)
    await user.click(screen.getByRole('button', { name: 'Desconectar bot' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]).toEqual({ telegramBotToken: '' })
  })

  it('cambiar el oficio actualiza el vocabulario sugerido', async () => {
    const puts = mockSettings({})
    const user = userEvent.setup()
    renderWithProviders(<BookingSettingsCard />)
    await user.selectOptions(await screen.findByDisplayValue('Barbería'), 'SPA')
    expect(screen.getByDisplayValue('reserva')).toBeInTheDocument()
    expect(screen.getByDisplayValue('terapeuta')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar ajustes' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]).toMatchObject({ vertical: 'SPA', labels: expect.objectContaining({ appointment: 'reserva', professional: 'terapeuta' }) })
  })
})
