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
  const slugs = { conLogo: `pwa-logo-${base}`, apaisado: `pwa-ancho-${base}`, sinLogo: `pwa-sin-${base}`, cerrado: `pwa-cerrado-${base}` };

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    app = (await import('../app')).default;
    // Logo cuadrado con fondo crema y un bloque oscuro en el centro, y otro apaisado igual: se ve dónde cae cada cosa.
    const CREAM = { r: 250, g: 246, b: 241 };
    const withBlock = async (w: number, h: number, bw: number, bh: number) =>
      sharp({ create: { width: w, height: h, channels: 4, background: { ...CREAM, alpha: 1 } } })
        .composite([{ input: await sharp({ create: { width: bw, height: bh, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 1 } } }).png().toBuffer(), gravity: 'center' }])
        .png()
        .toBuffer();
    const toUrl = (png: Buffer) => `data:image/png;base64,${png.toString('base64')}`;
    const dataUrl = toUrl(await withBlock(256, 256, 128, 128));
    const wideUrl = toUrl(await withBlock(400, 200, 100, 100));
    await ctx.runAsAdmin(async () => {
      const make = async (slug: string, name: string, settings: object) => {
        const t = await prisma.tenant.create({ data: { name, slug } });
        tenants.push(t.id);
        await prisma.tenantSettings.create({ data: { tenantId: t.id, ...settings } });
      };
      await make(slugs.conLogo, 'Yumi Manicure Studio', { logoUrl: dataUrl, brandColor: '#D63B2D' });
      await make(slugs.apaisado, 'Salón apaisado', { logoUrl: wideUrl });
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

  const pixels = async (slug: string, file: string) => {
    const res = await icon(slug, file);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    const { data, info } = await sharp(res.body as Buffer).raw().toBuffer({ resolveWithObject: true });
    const at = (fx: number, fy: number) => Array.from(data.subarray((Math.floor(fy * info.height) * info.width + Math.floor(fx * info.width)) * info.channels, (Math.floor(fy * info.height) * info.width + Math.floor(fx * info.width)) * info.channels + 3));
    return { width: info.width, height: info.height, at };
  };
  const CREAM = [250, 246, 241];
  const DARK = [20, 20, 20];

  it.each([
    ['192', 192],
    ['512', 512],
    ['apple-180', 180],
  ])('el icono %s es un PNG cuadrado de %i px donde el logo llena todo el icono', async (file, size) => {
    const px = await pixels(slugs.conLogo, file);
    expect([px.width, px.height]).toEqual([size, size]);
    // el bloque oscuro ocupaba la mitad central del logo: si el logo llena el icono, cubre del 25 % al 75 %
    expect(px.at(0.3, 0.5)).toEqual(DARK);
    expect(px.at(0.7, 0.5)).toEqual(DARK);
    expect(px.at(0.2, 0.5)).toEqual(CREAM);
    // y no hay marco blanco: el borde es del color del logo
    expect(px.at(0.01, 0.01)).toEqual(CREAM);
  });

  it('el icono maskable deja el logo un poco más pequeño para que el recorte de Android no lo corte', async () => {
    const px = await pixels(slugs.conLogo, 'maskable-512');
    expect([px.width, px.height]).toEqual([512, 512]);
    // el bloque cae del 30 % al 70 % (margen del 10 % + mitad de un logo del 80 %)
    expect(px.at(0.27, 0.5)).toEqual(CREAM);
    expect(px.at(0.33, 0.5)).toEqual(DARK);
    expect(px.at(0.01, 0.01)).toEqual(CREAM); // el margen es del color del logo, no blanco
  });

  it('un logo apaisado se centra entero, sin recortarlo ni deformarlo, sobre el color de su fondo', async () => {
    const px = await pixels(slugs.apaisado, '512');
    // 400×200 con bloque de 100×100: entero en el ancho del icono, el bloque ocupa del 37,5 % al 62,5 % del lado
    expect(px.at(0.5, 0.5)).toEqual(DARK);
    expect(px.at(0.4, 0.5)).toEqual(DARK);
    expect(px.at(0.33, 0.5)).toEqual(CREAM);
    expect(px.at(0.5, 0.2)).toEqual(CREAM); // arriba y abajo, el color del fondo del logo
    expect(px.at(0.5, 0.8)).toEqual(CREAM);
  });

  it('un icono que no existe, o de un salón sin logo, responde 404', async () => {
    expect((await icon(slugs.conLogo, '999')).status).toBe(404);
    expect((await icon(slugs.sinLogo, '192')).status).toBe(404);
  });
});
