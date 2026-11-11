import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Los tests corren desde frontend/.
const publico = (ruta: string) => resolve(process.cwd(), 'public', ruta.replace(/^\//, ''));
const html = readFileSync(publico('landing.html'), 'utf8');

describe('landing (public/landing.html)', () => {
  it('tiene un solo h1, título y descripción dentro de los límites de buscadores', () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    const title = html.match(/<title>([^<]+)<\/title>/)![1];
    const description = html.match(/<meta name="description" content="([^"]+)"/)![1];
    expect(title.length).toBeLessThanOrEqual(65);
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it('el único destino de conversión es el WhatsApp de Afilao y todos los botones usan el mismo número', () => {
    const wa = [...html.matchAll(/href="(https:\/\/wa\.me\/[^"?]+)/g)].map((m) => m[1]);
    expect(wa.length).toBeGreaterThanOrEqual(4); // hero, precio, final y barra fija
    expect(new Set(wa)).toEqual(new Set(['https://wa.me/5355354530']));
  });

  it('no publica el testimonio hasta tener el texto real (queda comentado)', () => {
    const sinComentarios = html.replace(/<!--[\s\S]*?-->/g, '');
    expect(sinComentarios).not.toContain('class="testimonial"');
    expect(sinComentarios).not.toContain('<blockquote');
  });

  it('no promete cosas que la app no hace', () => {
    const texto = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').toLowerCase();
    expect(texto).not.toMatch(/recordatorios? (autom[aá]ticos? )?por whatsapp/);
    expect(texto).not.toMatch(/pagos? en l[ií]nea|cobra[rn]? (a tus )?clientas/);
    expect(texto).not.toMatch(/quedan \d+|últimas? (plazas|cupos)|oferta termina/);
  });

  it('cada imagen referenciada existe en public/', () => {
    const rutas = [...html.matchAll(/src="(\/landing\/[^"]+)"/g)].map((m) => m[1]);
    expect(rutas.length).toBeGreaterThanOrEqual(4);
    for (const r of rutas) expect(() => readFileSync(publico(r))).not.toThrow();
  });
});
