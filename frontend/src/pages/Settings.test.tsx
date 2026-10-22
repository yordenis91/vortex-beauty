import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import Settings from './Settings'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'

const settings = {
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
  dailySummary: true,
  telegramConfigured: false,
  telegramChatId: '',
  telegramBotUsername: null,
  telegramOwnerCode: null,
  logoUrl: null,
  brandColor: null,
  labels: {},
}

const hours = [1, 2].map((dayOfWeek) => ({
  id: `h${dayOfWeek}`, dayOfWeek, startTime: '09:00', endTime: '18:00', timeSlots: [], isOpen: true, maxAppointments: 0, createdAt: '', updatedAt: '',
}))

function mock() {
  server.use(
    http.get(`${API}/settings/booking`, () => HttpResponse.json(settings)),
    http.get(`${API}/settings/business-hours`, () => HttpResponse.json(hours)),
    http.get(`${API}/closed-dates`, () => HttpResponse.json([])),
  )
}

const panel = (id: string) => document.getElementById(`panel-${id}`)

describe('Configuración por fichas', () => {
  it('muestra una ficha a la vez y empieza por Negocio', async () => {
    mock()
    renderWithProviders(<Settings />, { route: '/admin/settings' })
    const tabs = await screen.findByRole('tablist', { name: 'Secciones de configuración' })
    expect(within(tabs).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Negocio', 'Marca', 'Horarios', 'Cierres', 'Reservas', 'Avisos'])
    expect(screen.getByRole('tab', { name: 'Negocio' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Tipo de negocio')).toBeVisible()
    expect(screen.getByText('Un hueco cada (minutos)')).not.toBeVisible() // es de Reservas
    expect(panel('horarios')).not.toBeVisible()
    expect(panel('cierres')).not.toBeVisible()
  })

  it('cambia de ficha sin perder lo escrito en las demás', async () => {
    mock()
    const user = userEvent.setup()
    renderWithProviders(<Settings />, { route: '/admin/settings' })
    await screen.findByText('Tipo de negocio')

    await user.click(screen.getByRole('tab', { name: 'Reservas' }))
    const gap = screen.getByDisplayValue('30')
    expect(gap).toBeVisible()
    await user.clear(gap)
    await user.type(gap, '45')
    expect(screen.getByText('Tipo de negocio')).not.toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'Avisos' }))
    expect(screen.getByText('Recordatorios (horas antes, separadas por coma)')).toBeVisible()
    expect(gap).not.toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'Reservas' }))
    expect(screen.getByDisplayValue('45')).toBeVisible() // el borrador sigue ahí
  })

  it('Horarios y Cierres tienen su propia ficha; el guardado de ajustes solo aparece en las de formulario', async () => {
    mock()
    const user = userEvent.setup()
    renderWithProviders(<Settings />, { route: '/admin/settings' })
    await screen.findByText('Tipo de negocio')
    expect(screen.getByRole('button', { name: 'Guardar ajustes' })).toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'Horarios' }))
    expect(panel('horarios')).toBeVisible()
    expect(screen.getByText('Lunes')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Guardar ajustes', hidden: true })).not.toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'Cierres' }))
    expect(panel('cierres')).toBeVisible()
    expect(panel('horarios')).not.toBeVisible()
  })

  it('cada día de Horarios se muestra resumido y se despliega para editarlo', async () => {
    mock()
    const user = userEvent.setup()
    renderWithProviders(<Settings />, { route: '/admin/settings?ficha=horarios' })
    expect((await screen.findAllByText('09:00 – 18:00', { selector: 'p' }))).toHaveLength(2) // lunes y martes
    expect(screen.queryAllByText('Hora de Apertura')).toHaveLength(0)
    await user.click(screen.getAllByRole('button', { name: 'Editar horario' })[0])
    expect(screen.getAllByText('Hora de Apertura')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Ocultar' }))
    expect(screen.queryAllByText('Hora de Apertura')).toHaveLength(0)
  })

  it('la ficha viene de la URL (?ficha=) y una desconocida cae en Negocio', async () => {
    mock()
    renderWithProviders(<Settings />, { route: '/admin/settings?ficha=avisos' })
    expect(await screen.findByRole('tab', { name: 'Avisos' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Recordatorios (horas antes, separadas por coma)')).toBeVisible()
  })

  it('una ficha desconocida cae en Negocio', async () => {
    mock()
    renderWithProviders(<Settings />, { route: '/admin/settings?ficha=nada' })
    expect(await screen.findByRole('tab', { name: 'Negocio' })).toHaveAttribute('aria-selected', 'true')
  })
})
