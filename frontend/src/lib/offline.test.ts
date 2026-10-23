import { describe, it, expect, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import api from './api'
import { OFFLINE_MESSAGE, OfflineError } from './offline'
import { shouldPersist } from './persistCache'
import { server, API } from '../test/server'

const setOnline = (online: boolean) => Object.defineProperty(navigator, 'onLine', { value: online, configurable: true })
afterEach(() => setOnline(true))

describe('sin conexión: escrituras', () => {
  it('con conexión, escribir funciona normal', async () => {
    server.use(http.post(`${API}/algo`, () => HttpResponse.json({ ok: true })))
    expect((await api.post('/algo', {})).data).toEqual({ ok: true })
  })

  it('sin conexión, POST, PUT y DELETE se rechazan al instante con un mensaje claro y sin llegar al servidor', async () => {
    let calls = 0
    server.use(http.all(`${API}/algo`, () => { calls += 1; return HttpResponse.json({}) }))
    setOnline(false)
    for (const method of ['post', 'put', 'delete'] as const) {
      const error = await api.request({ url: '/algo', method }).catch((e) => e)
      expect(error).toBeInstanceOf(OfflineError)
      expect(error.message).toBe(OFFLINE_MESSAGE)
    }
    expect(calls).toBe(0)
  })

  it('sin conexión, leer (GET) sigue su camino: lo resuelve la caché o el navegador', async () => {
    server.use(http.get(`${API}/algo`, () => HttpResponse.json({ leido: true })))
    setOnline(false)
    expect((await api.get('/algo')).data).toEqual({ leido: true })
  })
})

describe('qué se guarda en el dispositivo', () => {
  const q = (key: unknown[], status = 'success') => ({ queryKey: key, state: { status } }) as unknown as Parameters<typeof shouldPersist>[0]
  it('guarda la agenda y lo que necesita para mostrarse', () => {
    for (const key of ['appointments', 'clients', 'services', 'professionals', 'businessHours', 'closed-dates', 'booking-settings']) expect(shouldPersist(q([key]))).toBe(true)
    expect(shouldPersist(q(['clients', { archived: true }]))).toBe(true)
  })
  it('no guarda búsquedas, huecos ni nada de plataforma, enlaces o equipo', () => {
    for (const key of ['global-search', 'admin-slots', 'available-slots', 'calendar-feed', 'team', 'my-telegram-link', 'platform-tenants', 'client-profile']) expect(shouldPersist(q([key]))).toBe(false)
  })
  it('no guarda consultas que fallaron o siguen pendientes', () => {
    expect(shouldPersist(q(['appointments'], 'error'))).toBe(false)
    expect(shouldPersist(q(['appointments'], 'pending'))).toBe(false)
  })
})
