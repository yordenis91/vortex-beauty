import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

/** Marca blanca por salón: logo y color de la página pública de reserva. */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describeIfDb('marca del salón', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let app: import('express').Express;
  let tenantId: string;
  let slug: string;
  let owner: string;
  let staff: string;

  const login = async (email: string) =>
    (await request(app).post('/api/auth/login').send({ tenantSlug: slug, email, password: 'Temporal123' })).body.token as string;
  const save = (token: string, body: object) => request(app).put('/api/settings/booking').set('Authorization', `Bearer ${token}`).send(body);
  const catalog = () => request(app).get(`/api/public/booking/${slug}`);

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    app = (await import('../app')).default;
    slug = `mb-${Date.now().toString(36)}`;
    await ctx.runAsAdmin(async () => {
      const tenant = await prisma.tenant.create({ data: { name: 'Salón Marca', slug } });
      tenantId = tenant.id;
      const password = await bcrypt.hash('Temporal123', 4);
      await prisma.user.create({ data: { email: 'dueno@mb.com', password, name: 'Dueño', role: 'OWNER', tenantId } });
      await prisma.user.create({ data: { email: 'staff@mb.com', password, name: 'Staff', role: 'STAFF', tenantId } });
    });
    owner = await login('dueno@mb.com');
    staff = await login('staff@mb.com');
  });

  afterAll(async () => {
    await ctx.runAsAdmin(() => prisma.tenant.delete({ where: { id: tenantId } }));
    await adminPool.end();
  });

  it('sin marca, el catálogo público no trae logo ni color', async () => {
    const res = await catalog();
    expect(res.body.logoUrl).toBeNull();
    expect(res.body.brandColor).toBeNull();
  });

  it('el dueño guarda logo y color, y el catálogo público los muestra (color en mayúsculas)', async () => {
    const res = await save(owner, { logoUrl: PNG, brandColor: '#1f8a70' });
    expect(res.status).toBe(200);
    expect(res.body.brandColor).toBe('#1F8A70');
    const pub = await catalog();
    expect(pub.body.logoUrl).toBe(PNG);
    expect(pub.body.brandColor).toBe('#1F8A70');
  });

  it('rechaza colores mal formados, SVG y logos que no son imagen', async () => {
    expect((await save(owner, { brandColor: 'rojo' })).status).toBe(400);
    expect((await save(owner, { brandColor: '#fff' })).status).toBe(400);
    expect((await save(owner, { logoUrl: 'data:image/svg+xml;base64,PHN2Zy8+' })).status).toBe(400);
    expect((await save(owner, { logoUrl: 'https://ejemplo.com/logo.png' })).status).toBe(400);
    expect((await save(owner, { logoUrl: `data:image/png;base64,${'A'.repeat(140_000)}` })).status).toBe(400);
    expect((await catalog()).body.brandColor).toBe('#1F8A70');
  });

  it('un profesional (STAFF) no puede cambiar la marca', async () => {
    expect((await save(staff, { brandColor: '#000000' })).status).toBe(403);
    expect((await catalog()).body.brandColor).toBe('#1F8A70');
  });

  it("una cadena vacía quita el logo y el color", async () => {
    expect((await save(owner, { logoUrl: '', brandColor: '' })).status).toBe(200);
    const pub = await catalog();
    expect(pub.body.logoUrl).toBeNull();
    expect(pub.body.brandColor).toBeNull();
  });
});
