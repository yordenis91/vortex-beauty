import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import MyTelegramCard from './MyTelegramCard'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'

const link = (over: Record<string, unknown>) =>
  server.use(http.get(`${API}/professionals/me/telegram`, () => HttpResponse.json({ hasProfessional: true, botUsername: 'afilao_bot', linked: false, code: 'A1B2C3D4', ...over })))

describe('Avisos de Telegram del profesional', () => {
  it('sin ficha de profesional no muestra nada', async () => {
    link({ hasProfessional: false, botUsername: null, code: null })
    const { container } = renderWithProviders(<MyTelegramCard />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('sin enlazar: muestra el bot y el mensaje /vincular con su código', async () => {
    link({})
    renderWithProviders(<MyTelegramCard />)
    expect(await screen.findByRole('link', { name: '@afilao_bot' })).toHaveAttribute('href', 'https://t.me/afilao_bot')
    expect(screen.getByText('/vincular A1B2C3D4')).toBeInTheDocument()
  })

  it('si el salón no tiene bot, lo explica y no enseña código', async () => {
    link({ botUsername: null, code: null })
    renderWithProviders(<MyTelegramCard />)
    expect(await screen.findByText(/todavía no activó el bot/)).toBeInTheDocument()
    expect(screen.queryByText(/vincular/)).not.toBeInTheDocument()
  })

  it('vinculado: lo dice y permite desvincular', async () => {
    link({ linked: true, code: null })
    let deleted = 0
    server.use(http.delete(`${API}/professionals/me/telegram`, () => { deleted++; return HttpResponse.json({ message: 'ok' }) }))
    renderWithProviders(<MyTelegramCard />)
    expect(await screen.findByText(/Vinculado/)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Desvincular Telegram' }))
    await waitFor(() => expect(deleted).toBe(1))
  })
})
