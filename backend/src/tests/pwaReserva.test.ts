import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import request from 'supertest';
import sharp from 'sharp';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

/** Instalar la reserva en el celular: manifiesto e iconos propios de cada salón. */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

describeIfDb('reserva instalable: manifiesto e iconos', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let app: import('express').Express;
  const tenants: string[] = [];
  const base = Date.now().toString(36);
  const slugs = { conLogo: `pwa-logo-${base}`, sinLogo: `pwa-sin-${base}`, cerrado: `pwa-cerrado-${base}` };

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    app = (await import('../app')).default;
    // Logo apaisado (200×100) para comprobar que el icono no lo deforma.
    const logo = await sharp({ create: { width: 200, height: 100, channels: 4, background: { r: 214, g: 59, b: 45, alpha: 1 } } }).png().toBuffer();
    const dataUrl = `data:image/png;base64,${logo.toString('base64')}`;
    await ctx.runAsAdmin(async () => {
      const make = async (slug: string, name: string, settings: object) => {
        const t = await prisma.tenant.create({ data: { name, slug } });
        tenants.push(t.id);
        await prisma.tenantSettings.create({ data: { tenantId: t.id, ...settings } });
      };
      await make(slugs.conLogo, 'Yumi Manicure Studio', { logoUrl: dataUrl, brandColor: '#D63B2D' });
      await make(slugs.sinLogo, 'Barbería Demo', {});
      await make(slugs.cerrado, 'Salón cerrado', { bookingEnabled: false, logoUrl: dataUrl });
    });
  });

  afterAll(async () => {
    await ctx.runAsAdmin(async () => {
      for (const id of tenants) await prisma.tenant.delete({ where: { id } });
    });
    await adminPool.end();
  });

  const manifest = (slug: string) => request(app).get(`/api/public/booking/${slug}/manifest`);
  const icon = (slug: string, file: string) => request(app).get(`/api/public/booking/${slug}/icon/${file}.png`).buffer(true).parse((res, cb) => {
    const chunks: Buffer[] = [];
    res.on('data', (c: Buffer) => chunks.push(c));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
  });

  it('el manifiesto lleva el nombre, el alcance y el color del salón', async () => {
    const res = await manifest(slugs.conLogo);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/manifest\+json/);
    expect(res.body).toMatchObject({
      id: `/${slugs.conLogo}/reservar`,
      name: 'Yumi Manicure Studio',
      short_name: 'Yumi Manicu…',
      start_url: `/${slugs.conLogo}/reservar?origen=app`,
      scope: `/${slugs.conLogo}/`,
      display: 'standalone',
      theme_color: '#D63B2D',
    });
    expect(res.body.start_url.startsWith(res.body.scope)).toBe(true);
  });

  it('con logo, los iconos son los del salón', async () => {
    const { icons } = (await manifest(slugs.conLogo)).body;
    expect(icons.map((i: { src: string }) => i.src)).toEqual([
      `/${slugs.conLogo}/pwa-icon-192.png`,
      `/${slugs.conLogo}/pwa-icon-512.png`,
      `/${slugs.conLogo}/pwa-icon-maskable-512.png`,
    ]);
    expect(icons.map((i: { purpose: string }) => i.purpose)).toEqual(['any', 'any', 'maskable']);
  });

  it('sin logo, el manifiesto usa los iconos de Afilao y el color por defecto', async () => {
    const res = await manifest(slugs.sinLogo);
    expect(res.status).toBe(200);
    expect(res.body.icons[0].src).toBe('/icon-192.png');
    expect(res.body.theme_color).toBe('#14264A');
  });

  it('un salón inexistente o sin reservas en línea no se puede instalar', async () => {
    expect((await manifest('no-existe-nunca')).status).toBe(404);
    expect((await manifest(slugs.cerrado)).status).toBe(404);
  });

  it.each([
    ['192', 192],
    ['512', 512],
    ['maskable-512', 512],
    ['apple-180', 180],
  ])('el icono %s es un PNG cuadrado de %i px sin deformar el logo', async (file, size) => {
    const res = await icon(slugs.conLogo, file);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    const meta = await sharp(res.body as Buffer).metadata();
    expect([meta.width, meta.height]).toEqual([size, size]);
    // el logo apaisado queda centrado: arriba y abajo hay margen blanco, y en el centro el rojo del logo
    const { data } = await sharp(res.body as Buffer).raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => Array.from(data.subarray((y * size + x) * meta.channels!, (y * size + x) * meta.channels! + 3));
    expect(px(Math.floor(size / 2), 1)).toEqual([255, 255, 255]);
    expect(px(Math.floor(size / 2), Math.floor(size / 2))).toEqual([214, 59, 45]);
  });

  it('un icono que no existe, o de un salón sin logo, responde 404', async () => {
    expect((await icon(slugs.conLogo, '999')).status).toBe(404);
    expect((await icon(slugs.sinLogo, '192')).status).toBe(404);
  });
});
