import { afterEach, describe, it, expect, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import PublicShell from '@/pages/public/PublicShell'
import { ThemeProvider } from '@/components/ui/theme-provider'

/** matchMedia falso con el modo del sistema editable en caliente. */
function systemMode(initial: 'dark' | 'light') {
  let dark = initial === 'dark'
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() { return dark },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }))
  return (mode: 'dark' | 'light') => act(() => { dark = mode === 'dark'; listeners.forEach((fn) => fn()) })
}

const html = document.documentElement
const mountPublic = () => render(<ThemeProvider><PublicShell title="Salón"><p>x</p></PublicShell></ThemeProvider>)

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
  html.classList.remove('dark')
})

describe('páginas públicas: modo claro/oscuro del sistema', () => {
  it('con el sistema en oscuro, la página pública se pone oscura', () => {
    systemMode('dark')
    mountPublic()
    expect(html).toHaveClass('dark')
  })

  it('con el sistema en claro, queda clara', () => {
    systemMode('light')
    mountPublic()
    expect(html).not.toHaveClass('dark')
  })

  it('sigue al sistema en vivo, sin recargar', () => {
    const setSystem = systemMode('light')
    mountPublic()
    setSystem('dark')
    expect(html).toHaveClass('dark')
    setSystem('light')
    expect(html).not.toHaveClass('dark')
  })

  it('el tema guardado de la cuenta (claro) no le gana al sistema en una página pública', () => {
    systemMode('dark')
    window.localStorage.setItem('theme', 'light')
    mountPublic()
    expect(html).toHaveClass('dark')
  })

  it('al salir de la página pública vuelve el tema de la cuenta, no el del sistema', () => {
    systemMode('dark')
    window.localStorage.setItem('theme', 'light')
    const { unmount } = mountPublic()
    unmount()
    expect(html).not.toHaveClass('dark')
  })
})
