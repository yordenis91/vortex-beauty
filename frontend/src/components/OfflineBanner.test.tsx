import { describe, it, expect, afterEach } from 'vitest'
import { act, screen } from '@testing-library/react'
import { Toaster } from 'react-hot-toast'
import OfflineBanner from './OfflineBanner'
import { renderWithProviders } from '../test/render'

const setOnline = (online: boolean) => {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true })
  act(() => void window.dispatchEvent(new Event(online ? 'online' : 'offline')))
}
afterEach(() => Object.defineProperty(navigator, 'onLine', { value: true, configurable: true }))

describe('aviso de sin conexión', () => {
  it('con conexión no se ve', () => {
    renderWithProviders(<OfflineBanner />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('al perder la conexión aparece, con la hora de los datos guardados si la hay', () => {
    localStorage.setItem('afilao-last-sync', String(new Date('2026-10-23T14:32:00').getTime()))
    renderWithProviders(<OfflineBanner />)
    setOnline(false)
    expect(screen.getByRole('status')).toHaveTextContent(/Sin conexión\. Ves los datos guardados a las .*32\./)
    expect(screen.getByRole('status')).toHaveTextContent('Para hacer cambios necesitas internet')
  })

  it('sin hora guardada lo dice sin hora', () => {
    renderWithProviders(<OfflineBanner />)
    setOnline(false)
    expect(screen.getByRole('status')).toHaveTextContent('Ves los datos guardados. Para hacer cambios')
  })

  it('al volver la conexión desaparece y avisa «Conexión recuperada»', async () => {
    renderWithProviders(<><Toaster /><OfflineBanner /></>)
    setOnline(false)
    expect(screen.getByRole('status')).toBeInTheDocument()
    setOnline(true)
    expect(await screen.findByText('Conexión recuperada')).toBeInTheDocument()
    expect(screen.queryByText(/Sin conexión\./)).not.toBeInTheDocument()
  })
})
