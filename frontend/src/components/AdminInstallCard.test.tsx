import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminInstallCard from './AdminInstallCard'
import { resetInstallState, startCapturingInstallPrompt } from '../lib/pwaInstall'

const BUTTON = 'Añadir a mi pantalla de inicio'
const CLOSE = 'No volver a mostrar este aviso'
const KEY = 'afilao:install-cta-dismissed:yumi'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'

function chromeOffersInstall() {
  const prompt = vi.fn().mockResolvedValue(undefined)
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' as const }) })
  act(() => void window.dispatchEvent(event))
  return prompt
}

beforeEach(() => {
  localStorage.clear()
  resetInstallState()
  window.history.pushState({}, '', '/admin/dashboard')
  startCapturingInstallPrompt()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.history.pushState({}, '', '/')
})

describe('invitación a instalar Afilao en el panel', () => {
  it('en escritorio (nada que instalar) no se pinta', () => {
    render(<AdminInstallCard slug="yumi" />)
    expect(screen.queryByRole('region', { name: 'Instalar Afilao' })).toBeNull()
  })

  it('en Android, con el aviso de Chrome, invita y abre el diálogo de instalación', async () => {
    const prompt = chromeOffersInstall()
    render(<AdminInstallCard slug="yumi" />)
    expect(screen.getByRole('heading', { name: 'Instala tu Afilao en el celular' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: BUTTON }))
    expect(prompt).toHaveBeenCalledOnce()
  })

  it('en iPhone muestra los pasos de Safari', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE)
    render(<AdminInstallCard slug="yumi" />)
    await userEvent.click(screen.getByRole('button', { name: BUTTON }))
    expect(screen.getByText(/«Añadir a pantalla de inicio»/)).toBeInTheDocument()
  })

  it('al cerrarla se va y no vuelve a salir en ese salón', async () => {
    chromeOffersInstall()
    const { unmount } = render(<AdminInstallCard slug="yumi" />)
    await userEvent.click(screen.getByRole('button', { name: CLOSE }))
    expect(screen.queryByRole('heading', { name: 'Instala tu Afilao en el celular' })).toBeNull()
    expect(localStorage.getItem(KEY)).toBe('1')
    unmount()
    render(<AdminInstallCard slug="yumi" />)
    expect(screen.queryByRole('heading', { name: 'Instala tu Afilao en el celular' })).toBeNull()
  })

  it('cerrarla en un salón no la silencia en otro', () => {
    chromeOffersInstall()
    localStorage.setItem(KEY, '1')
    render(<AdminInstallCard slug="laura" />)
    expect(screen.getByRole('heading', { name: 'Instala tu Afilao en el celular' })).toBeInTheDocument()
  })

  it('sin almacenamiento disponible sigue funcionando', async () => {
    chromeOffersInstall()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    render(<AdminInstallCard slug="yumi" />)
    await userEvent.click(screen.getByRole('button', { name: CLOSE }))
    expect(screen.queryByRole('heading', { name: 'Instala tu Afilao en el celular' })).toBeNull()
  })

  it('ya instalada (abierta como app) no invita', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE)
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('standalone'), media: query, addEventListener: () => {}, removeEventListener: () => {} }))
    render(<AdminInstallCard slug="yumi" />)
    expect(screen.queryByRole('region', { name: 'Instalar Afilao' })).toBeNull()
  })

  it('mientras no se conoce el salón no se pinta', () => {
    chromeOffersInstall()
    render(<AdminInstallCard />)
    expect(screen.queryByRole('region', { name: 'Instalar Afilao' })).toBeNull()
  })
})
