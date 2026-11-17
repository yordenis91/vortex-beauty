import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InstallCard } from './InstallApp'
import PublicShell from './PublicShell'
import { resetInstallState, startCapturingInstallPrompt } from '../../lib/pwaInstall'

const BUTTON = 'Añadir a mi pantalla de inicio'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'

/** Lo que Chrome en Android manda cuando la página se puede instalar. */
function chromeOffersInstall() {
  const prompt = vi.fn().mockResolvedValue(undefined)
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' as const }) })
  act(() => void window.dispatchEvent(event))
  return { prompt, event }
}

const standalone = (on: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: on && query.includes('standalone'), media: query, addEventListener: () => {}, removeEventListener: () => {} }))

beforeEach(() => {
  resetInstallState()
  window.history.pushState({}, '', '/yumi/reservar')
  startCapturingInstallPrompt()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.history.pushState({}, '', '/')
})

describe('instalar la reserva en el celular', () => {
  it('sin nada que ofrecer (escritorio), no se pinta ningún botón', () => {
    render(<InstallCard salonName="Yumi" />)
    expect(screen.queryByRole('button', { name: BUTTON })).toBeNull()
    expect(screen.queryByText(/Guarda Yumi/)).toBeNull()
  })

  it('en Android, el botón aparece cuando Chrome avisa y abre el diálogo de instalación', async () => {
    render(<InstallCard salonName="Yumi" />)
    expect(screen.queryByRole('button', { name: BUTTON })).toBeNull()
    const { prompt, event } = chromeOffersInstall()
    expect(event.defaultPrevented).toBe(true) // se guarda el aviso: ya no sale el cartel automático del navegador
    await userEvent.click(await screen.findByRole('button', { name: BUTTON }))
    expect(prompt).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: BUTTON })).toBeNull() // un aviso sirve una vez
  })

  it('si el aviso llegó antes de pintar la página, el botón sale igual', () => {
    chromeOffersInstall()
    render(<InstallCard salonName="Yumi" />)
    expect(screen.getByRole('button', { name: BUTTON })).toBeInTheDocument()
  })

  it('en el iPhone, el botón despliega los pasos de Safari y se pliega al pulsarlo otra vez', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE)
    render(<InstallCard salonName="Yumi" />)
    const button = screen.getByRole('button', { name: BUTTON })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/«Añadir a pantalla de inicio»/)).toBeInTheDocument()
    await userEvent.click(button)
    expect(screen.queryByText(/«Añadir a pantalla de inicio»/)).toBeNull()
  })

  it('ya instalada (abierta como app), no ofrece nada', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE)
    standalone(true)
    render(<InstallCard salonName="Yumi" />)
    expect(screen.queryByRole('button', { name: BUTTON })).toBeNull()
  })

  it('en el navegador de Instagram o Facebook no se ofrece: ahí no se puede instalar', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(`${IPHONE} Instagram 300.0`)
    render(<InstallCard salonName="Yumi" />)
    expect(screen.queryByRole('button', { name: BUTTON })).toBeNull()
  })

  it('al instalarse desaparece el botón', async () => {
    render(<InstallCard salonName="Yumi" />)
    chromeOffersInstall()
    expect(await screen.findByRole('button', { name: BUTTON })).toBeInTheDocument()
    act(() => void window.dispatchEvent(new Event('appinstalled')))
    expect(screen.queryByRole('button', { name: BUTTON })).toBeNull()
  })

  it('la tarjeta de la confirmación nombra el salón', () => {
    chromeOffersInstall()
    render(<InstallCard salonName="Yumi Manicure" />)
    expect(screen.getByRole('heading', { name: 'Guarda Yumi Manicure en tu celular' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: BUTTON })).toBeInTheDocument()
  })
})

describe('sin fricción durante la reserva', () => {
  it('con la instalación disponible, el marco de la reserva no muestra ningún botón de instalar', () => {
    chromeOffersInstall()
    render(
      <PublicShell title="Yumi" salon={{ slug: 'yumi', name: 'Yumi' }}>
        <p>servicios</p>
      </PublicShell>,
    )
    expect(screen.queryByRole('button', { name: BUTTON })).toBeNull()
    expect(screen.queryByText(/pantalla de inicio/)).toBeNull()
  })
})

describe('qué se intercepta según la página', () => {
  const at = (path: string) => {
    resetInstallState()
    window.history.pushState({}, '', path)
    startCapturingInstallPrompt()
    return chromeOffersInstall().event.defaultPrevented
  }

  it('en el panel y en las pantallas de entrada se guarda el aviso', () => {
    for (const path of ['/admin/dashboard', '/admin', '/login', '/yumi/login']) expect(at(path), path).toBe(true)
  })

  it('en el resto (landing, superadmin) el navegador conserva su comportamiento', () => {
    for (const path of ['/', '/superadmin/login', '/superadmin/dashboard', '/design-system']) expect(at(path), path).toBe(false)
  })

  it('el aviso del panel no sirve para la reserva de un salón, ni al revés', () => {
    window.history.pushState({}, '', '/admin/dashboard')
    chromeOffersInstall()
    render(<InstallCard salonName="Yumi" />)
    expect(screen.queryByRole('button', { name: BUTTON })).toBeNull()
  })
})
