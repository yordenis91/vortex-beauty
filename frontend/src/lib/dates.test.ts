import { describe, it, expect } from 'vitest'
import { formatYmd } from './dates'

describe('formatYmd', () => {
  it('muestra el mismo día, sin importar la zona horaria', () => {
    expect(formatYmd('2026-11-20')).toBe('20/11/2026')
    expect(formatYmd('2026-01-01')).toBe('01/01/2026')
    expect(formatYmd('2026-11-20T00:00:00.000Z')).toBe('20/11/2026')
  })
  it('valores vacíos o raros no rompen', () => {
    expect(formatYmd('')).toBe('')
    expect(formatYmd(null)).toBe('')
    expect(formatYmd('mañana')).toBe('mañana')
  })
})
