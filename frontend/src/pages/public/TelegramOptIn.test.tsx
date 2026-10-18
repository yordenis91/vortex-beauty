import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TelegramOptIn from './TelegramOptIn'

const info = { botUsername: 'barberia_bot', linked: false, deepLink: 'https://t.me/barberia_bot?start=tok123' }

describe('TelegramOptIn', () => {
  it('no muestra nada si el salón no tiene bot', () => {
    const { container } = render(<TelegramOptIn telegram={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('ofrece el enlace al bot con el token de la cita', () => {
    render(<TelegramOptIn telegram={info} />)
    const link = screen.getByRole('link', { name: /recibir avisos por telegram/i })
    expect(link).toHaveAttribute('href', 'https://t.me/barberia_bot?start=tok123')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })

  it('confirma cuando el cliente ya lo activó', () => {
    render(<TelegramOptIn telegram={{ ...info, linked: true }} />)
    expect(screen.getByText(/recibirás tus avisos por telegram/i)).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
