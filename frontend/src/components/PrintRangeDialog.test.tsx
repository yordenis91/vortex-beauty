import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import toast from 'react-hot-toast'
import PrintRangeDialog from './PrintRangeDialog'
import PrintWeekButton from './PrintWeekButton'
import { server, API } from '../test/server'
import { useState } from 'react'

const DAY = new Date(2026, 10, 18) // miércoles 18 de noviembre de 2026
let asked: string[]

beforeEach(() => {
  asked = []
  vi.spyOn(window, 'open').mockImplementation(() => ({ location: { href: '' }, close: vi.fn() }) as unknown as Window)
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:hoja', revokeObjectURL: () => {} }))
  server.use(
    http.get(`${API}/appointments/print`, ({ request }) => {
      asked.push(new URL(request.url).search)
      return new HttpResponse(new Uint8Array([0x25]), { headers: { 'Content-Type': 'application/pdf' } })
    }),
  )
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  toast.remove()
})

function Harness() {
  const [open, setOpen] = useState(true)
  return <PrintRangeDialog open={open} onOpenChange={setOpen} date={DAY} />
}

describe('Imprimir otras fechas', () => {
  it('arranca en el día que se mira y pide ese rango', async () => {
    render(<Harness />)
    expect((screen.getByLabelText('Desde') as HTMLInputElement).value).toBe('2026-11-18')
    expect((screen.getByLabelText('Hasta') as HTMLInputElement).value).toBe('2026-11-18')
    const user = userEvent.setup()
    await user.clear(screen.getByLabelText('Hasta'))
    await user.type(screen.getByLabelText('Hasta'), '2026-12-05')
    await user.click(screen.getByRole('button', { name: 'Imprimir' }))
    await waitFor(() => expect(asked).toEqual(['?from=2026-11-18&to=2026-12-05']))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()) // se cierra al salir bien
  })

  it('no pide nada si el rango pasa de 92 días y lo explica', async () => {
    render(<Harness />)
    const user = userEvent.setup()
    await user.clear(screen.getByLabelText('Hasta'))
    await user.type(screen.getByLabelText('Hasta'), '2027-03-01')
    await user.click(screen.getByRole('button', { name: 'Imprimir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Elige hasta 92 días como máximo.')
    expect(asked).toEqual([])
  })

  it('no pide nada si el final es anterior al inicio', async () => {
    render(<Harness />)
    const user = userEvent.setup()
    await user.clear(screen.getByLabelText('Hasta'))
    await user.type(screen.getByLabelText('Hasta'), '2026-11-01')
    await user.click(screen.getByRole('button', { name: 'Imprimir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/anterior/)
    expect(asked).toEqual([])
  })

  it('Cancelar cierra sin pedir nada', async () => {
    render(<Harness />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(asked).toEqual([])
  })
})

describe('menú de impresión del encabezado', () => {
  it('«Imprimir este mes» pide el mes entero del día que se mira', async () => {
    render(<PrintWeekButton date={DAY} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Más formas de imprimir' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Imprimir este mes' }))
    await waitFor(() => expect(asked).toEqual(['?from=2026-11-01&to=2026-11-30']))
  })

  it('«Imprimir el mes que viene» pide el mes siguiente', async () => {
    render(<PrintWeekButton date={DAY} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Más formas de imprimir' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Imprimir el mes que viene' }))
    await waitFor(() => expect(asked).toEqual(['?from=2026-12-01&to=2026-12-31']))
  })

  it('«Imprimir otras fechas…» abre el diálogo', async () => {
    render(<PrintWeekButton date={DAY} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Más formas de imprimir' }))
    await user.click(await screen.findByRole('menuitem', { name: /Imprimir otras fechas/ }))
    expect(await screen.findByRole('dialog', { name: 'Imprimir otras fechas' })).toBeInTheDocument()
  })

  it('el botón principal sigue imprimiendo la semana', async () => {
    render(<PrintWeekButton date={DAY} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Imprimir mi semana' }))
    await waitFor(() => expect(asked).toEqual(['?week=2026-W47']))
  })
})
