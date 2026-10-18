import { describe, it, expect } from 'vitest';
import { actionScale, contrast, isHexColor } from './colors';

describe('colores de marca', () => {
  it('valida #RRGGBB', () => {
    expect(isHexColor('#1F8A70')).toBe(true);
    expect(isHexColor('#fff')).toBe(false);
    expect(isHexColor(null)).toBe(false);
  });

  it('un color oscuro se respeta tal cual en el paso 600', () => {
    expect(actionScale('#1F5FA8')[600]).toBe('#1F5FA8');
  });

  it.each(['#FFE066', '#F8C8DC', '#FFFFFF', '#00FF00', '#FF6B57'])('el paso 600 de %s se lee con texto blanco (contraste ≥ 4,5)', (color) => {
    expect(contrast(actionScale(color)[600], '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });

  it('la escala va de claro a oscuro', () => {
    const s = actionScale('#1F8A70');
    expect(contrast(s[50], '#FFFFFF')).toBeLessThan(contrast(s[600], '#FFFFFF'));
    expect(contrast(s[600], '#FFFFFF')).toBeLessThan(contrast(s[900], '#FFFFFF'));
  });
});
