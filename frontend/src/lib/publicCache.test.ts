import { describe, it, expect } from 'vitest'
import { fingerprint, forget, readSaved, save } from './publicCache'

describe('datos guardados de las páginas públicas', () => {
  it('guarda y recupera con su hora de guardado', () => {
    save('catalog:demo', { name: 'Demo' })
    const saved = readSaved<{ name: string }>('catalog:demo')!
    expect(saved.value).toEqual({ name: 'Demo' })
    expect(Date.now() - saved.savedAt).toBeLessThan(2000)
  })

  it('lo de hace más de 7 días caduca y se borra', () => {
    save('catalog:demo', { name: 'Demo' })
    const inEightDays = Date.now() + 8 * 24 * 3600 * 1000
    expect(readSaved('catalog:demo', inEightDays)).toBeUndefined()
    expect(readSaved('catalog:demo')).toBeUndefined()
  })

  it('olvidar borra, y lo ilegible se ignora', () => {
    save('a', 1)
    forget('a')
    expect(readSaved('a')).toBeUndefined()
    localStorage.setItem('afilao:pub:v1:roto', '{no es json')
    expect(readSaved('roto')).toBeUndefined()
  })

  it('sin almacenamiento no falla', () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('lleno')
    }
    try {
      expect(() => save('a', 1)).not.toThrow()
    } finally {
      Storage.prototype.setItem = original
    }
  })

  it('la huella del enlace no contiene el enlace y es estable', () => {
    const token = 'glNGOuiMRIRlJbeVLaKXfPD_XVhu3L2MWN8LJHOKM2s'
    expect(fingerprint(token)).toBe(fingerprint(token))
    expect(fingerprint(token)).not.toContain(token.slice(0, 8))
    expect(fingerprint(token)).not.toBe(fingerprint(token + 'x'))
  })
})
