import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import PublicShell from '@/pages/public/PublicShell'

const head = (selector: string) => document.head.querySelector(selector)

beforeEach(() => {
  document.head.innerHTML = '<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#14264A">'
  document.title = 'Afilao'
})
afterEach(() => {
  document.head.innerHTML = ''
})

const salon = { slug: 'yumi', name: 'Yumi Manicure', logoUrl: 'data:image/png;base64,AAAA', brandColor: '#D63B2D' }

describe('la página pública se presenta como la app del salón', () => {
  it('cambia el manifiesto, el icono, el nombre y el color por los del salón', () => {
    render(<PublicShell title="Yumi Manicure" salon={salon}><p>x</p></PublicShell>)
    expect(head('link[rel="manifest"]')).toHaveAttribute('href', '/yumi/manifest.webmanifest')
    expect(head('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/yumi/pwa-icon-apple-180.png')
    expect(head('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Yumi Manicure')
    expect(head('meta[name="theme-color"]')).toHaveAttribute('content', '#D63B2D')
    expect(document.title).toBe('Yumi Manicure')
  })

  it('sin logo no pone icono propio (se queda el de Afilao)', () => {
    render(<PublicShell title="Salón" salon={{ ...salon, logoUrl: null }}><p>x</p></PublicShell>)
    expect(head('link[rel="apple-touch-icon"]')).toBeNull()
  })

  it('al salir de la página deja el <head> como estaba', () => {
    const { unmount } = render(<PublicShell title="Yumi Manicure" salon={salon}><p>x</p></PublicShell>)
    unmount()
    expect(head('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
    expect(head('meta[name="theme-color"]')).toHaveAttribute('content', '#14264A')
    expect(head('link[rel="apple-touch-icon"]')).toBeNull()
    expect(head('meta[name="apple-mobile-web-app-title"]')).toBeNull()
    expect(document.title).toBe('Afilao')
  })

  it('mientras no se conoce el salón no toca nada', () => {
    render(<PublicShell title="Reservar"><p>x</p></PublicShell>)
    expect(head('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
    expect(document.title).toBe('Afilao')
  })
})
