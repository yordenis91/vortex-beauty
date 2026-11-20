import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectionProblem, LoadingPage, StaleNotice } from './shared'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('LoadingPage', () => {
  it('al principio solo gira; si tarda más de 6 s dice que la conexión está lenta', () => {
    vi.useFakeTimers()
    render(<LoadingPage />)
    expect(screen.queryByText(/tu conexión está lenta/)).not.toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(6100))
    expect(screen.getByText(/Conectando… tu conexión está lenta/)).toBeInTheDocument()
  })

  it('mientras reintenta lo dice enseguida', () => {
    render(<LoadingPage retrying />)
    expect(screen.getByText('Reintentando… tu conexión está lenta.')).toBeInTheDocument()
  })
})

describe('ConnectionProblem', () => {
  it('distingue conexión lenta, sin internet y servidor caído, y reintenta', async () => {
    const retry = vi.fn()
    const view = render(<ConnectionProblem kind="connection" onRetry={retry} />)
    expect(screen.getByText('No pudimos conectar')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(retry).toHaveBeenCalledOnce()

    view.rerender(<ConnectionProblem kind="server" onRetry={retry} />)
    expect(screen.getByText('Estamos con problemas')).toBeInTheDocument()

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    view.rerender(<ConnectionProblem kind="connection" onRetry={retry} />)
    expect(screen.getByText('Sin conexión')).toBeInTheDocument()
  })

  it('mientras reintenta, el botón se desactiva', () => {
    render(<ConnectionProblem kind="connection" onRetry={() => undefined} retrying />)
    expect(screen.getByRole('button', { name: 'Reintentando…' })).toBeDisabled()
  })
})

describe('StaleNotice', () => {
  it('muestra el aviso y su botón de reintentar', async () => {
    const retry = vi.fn()
    render(<StaleNotice onRetry={retry}>Datos guardados</StaleNotice>)
    expect(screen.getByRole('status')).toHaveTextContent('Datos guardados')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
