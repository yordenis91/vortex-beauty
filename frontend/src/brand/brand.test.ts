import { describe, it, expect } from 'vitest';
import { applyBrand, brand, brandForHost } from './brand';

describe('marca', () => {
  it('elige la marca por dominio y cae en la primera si no hay coincidencia', () => {
    expect(brandForHost('afilao.app').name).toBe('Afilao');
    expect(brandForHost('barberia.afilao.app').name).toBe('Afilao');
    expect(brandForHost('deploy-vortex-frontend.wgteoi.easypanel.host').name).toBe('Afilao');
  });

  it('applyBrand pone título, color del navegador y escala de acción', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#ffffff">';
    applyBrand(brand);
    expect(document.title).toBe('Afilao');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(brand.colors.themeColor);
    expect(document.documentElement.style.getPropertyValue('--color-blue-600')).toBe(brand.colors.action[600]);
  });
});
