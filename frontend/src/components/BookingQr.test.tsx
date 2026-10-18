import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import BookingQr from './BookingQr'

describe('BookingQr', () => {
  it('genera el código QR del enlace y habilita las descargas', async () => {
    render(<BookingQr url="https://demo.test/r/barberia-demo" salonName="Barbería Demo" />)
    const printBtn = screen.getByRole('button', { name: 'Imprimir cartel' })
    expect(printBtn).toBeDisabled()
    await waitFor(() => expect(printBtn).toBeEnabled())
    expect(screen.getByRole('img', { name: 'Código QR de reservas' }).querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Descargar PNG' })).toBeEnabled()
  })
})
