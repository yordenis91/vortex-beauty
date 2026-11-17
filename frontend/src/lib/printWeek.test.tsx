import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { waitFor, screen, render } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { isoWeekParam, monthRange, printRange, printWeek, rangeProblem } from './printWeek'
import { server, API } from '../test/server'

describe('semana a imprimir', () => {
  it('es la semana ISO del día que se mira (lunes a domingo)', () => {
    expect(isoWeekParam(new Date(2026, 10, 16))).toBe('2026-W47') // lunes
    expect(isoWeekParam(new Date(2026, 10, 22))).toBe('2026-W47') // domingo
    expect(isoWeekParam(new Date(2026, 10, 23))).toBe('2026-W48')
    expect(isoWeekParam(new Date(2027, 0, 1))).toBe('2026-W53') // la semana cruza el año
    expect(isoWeekParam(new Date(2025, 11, 29))).toBe('2026-W01')
  })
})

describe('rango a imprimir', () => {
  it('el mes del día que se mira, y el que viene', () => {
    expect(monthRange(new Date(2026, 10, 18))).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(monthRange(new Date(2026, 10, 18), 1)).toEqual({ from: '2026-12-01', to: '2026-12-31' })
    expect(monthRange(new Date(2026, 11, 20), 1)).toEqual({ from: '2027-01-01', to: '2027-01-31' }) // cruza el año
    expect(monthRange(new Date(2028, 0, 31), 1)).toEqual({ from: '2028-02-01', to: '2028-02-29' }) // bisiesto
  })

  it('valida igual que el servidor: completo, en orden y hasta 92 días', () => {
    expect(rangeProblem('2026-11-01', '2026-11-30')).toBeNull()
    expect(rangeProblem('2026-11-16', '2026-11-16')).toBeNull()
    expect(rangeProblem('2026-01-01', '2026-04-02')).toBeNull() // 92 días
    expect(rangeProblem('2026-01-01', '2026-04-03')).toMatch(/92 días/)
    expect(rangeProblem('2026-11-30', '2026-11-01')).toMatch(/anterior/)
    expect(rangeProblem('', '2026-11-01')).toMatch(/Elige la fecha/)
  })
})

describe('imprimir mi semana', () => {
  const created: string[] = []
  let tab: { location: { href: string }; close: ReturnType<typeof vi.fn> }
  let asked: string[]

  beforeEach(() => {
    asked = []
    tab = { location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockImplementation(() => tab as unknown as Window)
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: (b: Blob) => (created.push(b.type), 'blob:hoja'), revokeObjectURL: () => {} }))
    server.use(
      http.get(`${API}/appointments/print`, ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('week') ?? '')
        return new HttpResponse(new Uint8Array([0x25, 0x50, 0x44, 0x46]), { headers: { 'Content-Type': 'application/pdf' } })
      }),
    )
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    created.length = 0
    toast.remove()
  })

  it('pide la semana del día y abre el PDF en la pestaña que ya había abierto', async () => {
    expect(await printWeek(new Date(2026, 10, 18))).toBe(true)
    expect(asked).toEqual(['2026-W47'])
    expect(window.open).toHaveBeenCalledWith('', '_blank') // se abre antes de esperar: así no la bloquea el navegador
    expect(tab.location.href).toBe('blob:hoja')
    expect(created).toEqual(['application/pdf'])
  })

  it('un rango pide desde y hasta al servidor', async () => {
    let query = ''
    server.use(http.get(`${API}/appointments/print`, ({ request }) => {
      query = new URL(request.url).search
      return new HttpResponse(new Uint8Array([0x25]), { headers: { 'Content-Type': 'application/pdf' } })
    }))
    expect(await printRange('2026-11-01', '2026-11-30')).toBe(true)
    expect(query).toBe('?from=2026-11-01&to=2026-11-30')
    expect(tab.location.href).toBe('blob:hoja')
  })

  it('si el navegador no deja abrir pestañas, descarga el archivo', async () => {
    vi.mocked(window.open).mockReturnValue(null)
    const clicked: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this.download) })
    expect(await printWeek(new Date(2026, 10, 18))).toBe(true)
    expect(clicked).toEqual(['agenda-2026-W47.pdf'])
  })

  it('si falla, cierra la pestaña en blanco y lo dice', async () => {
    server.use(http.get(`${API}/appointments/print`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })))
    render(<Toaster />)
    expect(await printWeek(new Date(2026, 10, 18))).toBe(false)
    expect(tab.close).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByText(/No se pudo preparar la hoja/)).toBeInTheDocument())
  })
})
