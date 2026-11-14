import { describe, it, expect } from 'vitest';
import { actionScale, contrast, darkActionScale, isHexColor } from './colors';

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

describe('escala para el modo oscuro', () => {
  it.each(['#14264A', '#000000', '#FFE066', '#FFFFFF', '#D63B2D', '#1F8A70'])('el paso 600 de %s se lee con texto blanco y se distingue del fondo oscuro', (color) => {
    const c600 = darkActionScale(color)[600];
    expect(contrast(c600, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c600, '#262626')).toBeGreaterThanOrEqual(3);
  });
});
