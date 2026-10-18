import { describe, it, expect, afterEach } from 'vitest'
import { takePrefetchedCatalog, type PublicCatalog } from './publicApi'

const catalog = { name: 'Barbería', slug: 'barberia-demo' } as unknown as PublicCatalog

describe('takePrefetchedCatalog', () => {
  afterEach(() => {
    window.__catalog = undefined
  })

  it('devuelve el catálogo adelantado por index.html y solo una vez', async () => {
    window.__catalog = { slug: 'barberia-demo', promise: Promise.resolve(catalog) }
    expect(await takePrefetchedCatalog('barberia-demo')).toBe(catalog)
    expect(await takePrefetchedCatalog('barberia-demo')).toBeNull()
  })

  it('ignora el adelanto si es de otro salón', async () => {
    window.__catalog = { slug: 'otro', promise: Promise.resolve(catalog) }
    expect(await takePrefetchedCatalog('barberia-demo')).toBeNull()
  })

  it('devuelve null si el adelanto falló (se pedirá de nuevo con axios)', async () => {
    window.__catalog = { slug: 'barberia-demo', promise: Promise.reject(new Error('catalog 404')) }
    expect(await takePrefetchedCatalog('barberia-demo')).toBeNull()
  })

  it('sin adelanto devuelve null', async () => {
    expect(await takePrefetchedCatalog('barberia-demo')).toBeNull()
  })
})
