import { describe, it, expect } from 'vitest'
import { normalizePhone } from './phone'

describe('normalizePhone (igual que el servidor)', () => {
  it('todas las formas del mismo número dan +5355354530', () => {
    for (const v of ['55354530', '5535 4530', '+53 5535 4530', '(+53) 5535 4530', '53 5535 4530', '5355354530', '0053 55354530', ' +53-5535-4530 ']) {
      expect(normalizePhone(v), v).toBe('+5355354530')
    }
  })
  it('respeta otros países y rechaza lo inválido', () => {
    expect(normalizePhone('+34 612 345 678')).toBe('+34612345678')
    expect(normalizePhone('34612345678')).toBe('+34612345678')
    for (const v of [null, '', 'abc', '123', '+53 12']) expect(normalizePhone(v)).toBeNull()
  })
})
