import { describe, it, expect, beforeEach } from 'vitest'
import { AxiosError } from 'axios'
import { errorKind, isTransient, retryDelay, retryTransient, setRetryDelays } from './publicConnectivity'
import { apiErrorMessage, CONNECTION_MESSAGE, publicApi, READ_TIMEOUT_MS, WRITE_TIMEOUT_MS } from './publicApi'

const withStatus = (status: number) => ({ response: { status } })
const networkError = () => new AxiosError('Network Error', 'ERR_NETWORK')

describe('errorKind', () => {
  it('sin respuesta del servidor (sin red, sin señal o tiempo agotado) es de conexión', () => {
    expect(errorKind(networkError())).toBe('connection')
    expect(errorKind(new AxiosError('timeout of 25000ms exceeded', 'ECONNABORTED'))).toBe('connection')
  })

  it('solo un 404 es «no existe»', () => {
    expect(errorKind(withStatus(404))).toBe('not-found')
    expect(errorKind(withStatus(400))).toBe('other')
    expect(errorKind(withStatus(403))).toBe('other')
  })

  it('los 5xx, 408 y 429 son del servidor y pasajeros', () => {
    for (const status of [500, 502, 503, 504, 408, 429]) expect(errorKind(withStatus(status))).toBe('server')
  })

  it('un valor vacío no se toma por un problema de conexión', () => {
    expect(errorKind(undefined)).toBe('other')
    expect(errorKind(null)).toBe('other')
  })
})

describe('reintentos', () => {
  beforeEach(() => setRetryDelays([1000, 3000, 6000]))

  it('reintenta hasta tres veces solo lo pasajero', () => {
    expect(retryTransient(0, networkError())).toBe(true)
    expect(retryTransient(2, withStatus(503))).toBe(true)
    expect(retryTransient(3, networkError())).toBe(false)
    expect(retryTransient(0, withStatus(404))).toBe(false)
    expect(retryTransient(0, withStatus(400))).toBe(false)
    expect(isTransient(withStatus(500))).toBe(true)
  })

  it('espera más en cada reintento', () => {
    expect([0, 1, 2].map(retryDelay)).toEqual([1000, 3000, 6000])
    expect(retryDelay(9)).toBe(6000)
  })
})

describe('publicApi', () => {
  it('tiene tiempo máximo: 25 s al leer y 45 s al escribir', async () => {
    expect(publicApi.defaults.timeout).toBe(READ_TIMEOUT_MS)
    const seen: Record<string, number | undefined> = {}
    const adapter = async (config: { method?: string; timeout?: number }) => {
      seen[config.method ?? 'get'] = config.timeout
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config } as never
    }
    await publicApi.get('/x', { adapter })
    await publicApi.post('/x', {}, { adapter })
    expect(seen.get).toBe(READ_TIMEOUT_MS)
    expect(seen.post).toBe(WRITE_TIMEOUT_MS)
  })

  it('un fallo de red se explica como conexión, no como «algo salió mal»', () => {
    expect(apiErrorMessage(networkError())).toBe(CONNECTION_MESSAGE)
    expect(apiErrorMessage({ response: { data: { error: 'Ese horario ya no está disponible' } } })).toBe('Ese horario ya no está disponible')
    expect(apiErrorMessage(new Error('x'))).toBe('Algo salió mal. Inténtalo de nuevo.')
  })
})
