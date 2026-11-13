import { afterEach, describe, it, expect } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import PublicShell from './PublicShell'

describe('PublicShell con la marca del salón', () => {
  it('sin marca: sin logo y sin variables de color propias', () => {
    const { container } = render(<PublicShell title="Barbería Demo"><p>contenido</p></PublicShell>)
    expect(screen.queryByRole('img', { name: 'Barbería Demo' })).toBeNull()
    expect((container.firstChild as HTMLElement).style.getPropertyValue('--color-blue-600')).toBe('')
  })

  it('con logo y color: muestra el logo y aplica un color de acción legible', () => {
    const { container } = render(
      <PublicShell title="Barbería Demo" salon={{ name: 'Barbería Demo', logoUrl: 'data:image/png;base64,AAAA', brandColor: '#FFE066' }}>
        <p>contenido</p>
      </PublicShell>,
    )
    expect(screen.getByRole('img', { name: 'Barbería Demo' })).toHaveAttribute('src', 'data:image/png;base64,AAAA')
    const root = container.firstChild as HTMLElement
    // el amarillo pastel se oscurece: no queda igual que el que eligió el dueño
    expect(root.style.getPropertyValue('--color-blue-600')).not.toBe('#FFE066')
    expect(root.style.getPropertyValue('--color-blue-600')).toMatch(/^#[0-9A-F]{6}$/)
    expect(root.style.getPropertyValue('--primary-foreground')).toBe('#FFFFFF')
  })

  it('ignora un color mal formado', () => {
    const { container } = render(<PublicShell title="X" salon={{ brandColor: 'rojo; background:url(x)' }}><p>c</p></PublicShell>)
    expect((container.firstChild as HTMLElement).style.getPropertyValue('--color-blue-600')).toBe('')
  })
})

describe('PublicShell: cabecera fija', () => {
  const scrollTo = (y: number) =>
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true })
      window.dispatchEvent(new Event('scroll'))
    })

  afterEach(() => scrollTo(0))

  it('queda pegada arriba y se compacta al bajar; solo se expande al volver casi arriba (sin parpadeo)', () => {
    const { container } = render(<PublicShell title="Barbería Demo" subtitle="Reserva tu turno en línea"><p>contenido</p></PublicShell>)
    const header = container.querySelector('header')!
    expect(header).toHaveClass('sticky', 'top-0')
    expect(header).toHaveAttribute('data-compact', 'false')

    scrollTo(30) // todavía por debajo del umbral
    expect(header).toHaveAttribute('data-compact', 'false')
    scrollTo(120)
    expect(header).toHaveAttribute('data-compact', 'true')
    scrollTo(30) // histéresis: compactar acorta la página, volver a expandir aquí haría parpadear
    expect(header).toHaveAttribute('data-compact', 'true')
    scrollTo(0)
    expect(header).toHaveAttribute('data-compact', 'false')
  })

  it('el nombre del negocio sigue visible al compactarse', () => {
    render(<PublicShell title="Barbería Demo"><p>contenido</p></PublicShell>)
    scrollTo(200)
    expect(screen.getByRole('heading', { name: 'Barbería Demo' })).toBeVisible()
  })
})
