import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { waitFor, screen, render } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import { isoWeekParam, printWeek } from './printWeek'
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
    await waitFor(() => expect(screen.getByText(/No se pudo preparar la hoja de la semana/)).toBeInTheDocument())
  })
})
