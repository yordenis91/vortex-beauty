import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

/** Clientes creados a mano: el correo es opcional, pero hace falta un teléfono o un correo para reconocerlos. */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

describeIfDb('clientes: contacto opcional', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let app: import('express').Express;
  let tenantId: string;
  let token: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const create = (body: object) => request(app).post('/api/clients').set(auth()).send(body);
  const keyOf = (id: string) => adminPool.query('SELECT email, phone, "phoneKey" FROM "Client" WHERE id = $1', [id]).then((r) => r.rows[0]);

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    app = (await import('../app')).default;
    const slug = `contacto-${Date.now().toString(36)}`;
    const hash = await bcrypt.hash('secret123', 4);
    await ctx.runAsAdmin(async () => {
      tenantId = (await prisma.tenant.create({ data: { name: 'Salón contacto', slug } })).id;
      await prisma.tenantSettings.create({ data: { tenantId } });
      await prisma.user.create({ data: { email: 'owner@c.com', password: hash, name: 'Dueña', role: 'OWNER', tenantId } });
    });
    token = (await request(app).post('/api/auth/login').send({ tenantSlug: slug, email: 'owner@c.com', password: 'secret123' })).body.token;
  });

  afterAll(async () => {
    await ctx.runAsAdmin(() => prisma.tenant.delete({ where: { id: tenantId } }));
    await adminPool.end();
  });

  it('crea un cliente solo con teléfono: sin correo y con el teléfono normalizado', async () => {
    const res = await create({ name: 'Marta', phone: '+53 5 555 1234' });
    expect(res.status).toBe(201);
    expect(await keyOf(res.body.id)).toMatchObject({ email: null, phone: '+53 5 555 1234', phoneKey: '5355551234' });
  });

  it('un correo vacío cuenta como sin correo', async () => {
    const res = await create({ name: 'Luisa', email: '', phone: '+53 5 555 9999' });
    expect(res.status).toBe(201);
    expect((await keyOf(res.body.id)).email).toBeNull();
  });

  it('crea un cliente solo con correo', async () => {
    const res = await create({ name: 'Ana', email: 'ana@example.com' });
    expect(res.status).toBe(201);
    expect(await keyOf(res.body.id)).toMatchObject({ email: 'ana@example.com', phoneKey: null });
  });

  it('exige un teléfono o un correo', async () => {
    const res = await create({ name: 'Sin datos' });
    expect(res.status).toBe(400);
    expect((await create({ name: 'Sin datos', email: '', phone: '123' })).status).toBe(400); // un teléfono demasiado corto no vale
  });

  it('un correo inválido se rechaza', async () => {
    expect((await create({ name: 'X', email: 'no-es-correo', phone: '+53 5 555 7777' })).status).toBe(400);
  });

  it('un teléfono o un correo repetido responde 409 con el motivo', async () => {
    const phone = await create({ name: 'Otra Marta', phone: '53-5-555-1234' }); // el mismo número escrito distinto
    expect(phone.status).toBe(409);
    expect(phone.body.error).toMatch(/teléfono/);
    const mail = await create({ name: 'Otra Ana', email: 'ana@example.com' });
    expect(mail.status).toBe(409);
    expect(mail.body.error).toMatch(/correo/);
  });

  it('al editar, el teléfono se vuelve a normalizar y un valor vacío lo quita', async () => {
    const { body } = await create({ name: 'Rosa', email: 'rosa@example.com', phone: '+53 5 555 2000' });
    const changed = await request(app).put(`/api/clients/${body.id}`).set(auth()).send({ phone: '+53 5 555 2001' });
    expect(changed.status).toBe(200);
    expect(await keyOf(body.id)).toMatchObject({ phoneKey: '5355552001' });

    const cleared = await request(app).put(`/api/clients/${body.id}`).set(auth()).send({ phone: '', email: '' });
    expect(cleared.status).toBe(200);
    expect(await keyOf(body.id)).toMatchObject({ email: null, phone: null, phoneKey: null });
  });

  it('editar a un teléfono que ya tiene otra ficha responde 409', async () => {
    const { body } = await create({ name: 'Eva', email: 'eva@example.com' });
    const res = await request(app).put(`/api/clients/${body.id}`).set(auth()).send({ phone: '+53 5 555 1234' });
    expect(res.status).toBe(409);
  });
});
