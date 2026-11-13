import { describe, it, expect } from 'vitest';
import { normalizePhone, phoneKey } from '../lib/phone';

describe('normalizePhone (código de país por defecto +53)', () => {
  it('todas las formas de escribir el mismo número dan el mismo resultado', () => {
    const variants = [
      '55354530', '5535 4530', '5 5354530', '+53 5535 4530', '(+53) 5535 4530', '+53-5535-4530',
      '53 5535 4530', '5355354530', '0053 55354530', '  +5355354530 ', '(53) 55354530',
    ];
    for (const v of variants) expect(normalizePhone(v), v).toBe('+5355354530');
    for (const v of variants) expect(phoneKey(v), v).toBe('5355354530');
  });

  it('respeta otros países cuando se indican', () => {
    expect(normalizePhone('+34 612 345 678')).toBe('+34612345678');
    expect(normalizePhone('0034 612345678')).toBe('+34612345678');
    expect(normalizePhone('34612345678')).toBe('+34612345678'); // 9+ cifras: ya lleva país
    expect(normalizePhone('+1 (555) 123-4567')).toBe('+15551234567');
  });

  it('fijos cubanos de 8 cifras (7xxxxxxx) llevan el 53', () => {
    expect(normalizePhone('7 833 4455')).toBe('+5378334455');
  });

  it('rechaza lo que no es un teléfono', () => {
    for (const v of [null, undefined, '', '   ', 'abc', '123', '+53 12', '1'.repeat(16)]) expect(normalizePhone(v as string)).toBeNull();
    expect(phoneKey('abc')).toBeNull();
  });
});
