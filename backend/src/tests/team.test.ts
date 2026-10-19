import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

/** Equipo del salón: el dueño crea, restablece, desactiva y elimina cuentas de acceso. */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

describeIfDb('equipo del salón', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let app: import('express').Express;
  let tenantId: string;
  let otherTenantId: string;
  let slug: string;
  let proFree: string;
  let ownerId: string;
  const tokens: Record<string, string> = {};

  const login = (email: string, password = 'secret123') => request(app).post('/api/auth/login').send({ tenantSlug: slug, email, password });
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    app = (await import('../app')).default;
    const hash = await bcrypt.hash('secret123', 4);
    slug = `team-${Date.now().toString(36)}`;
    await ctx.runAsAdmin(async () => {
      const tenant = await prisma.tenant.create({ data: { name: 'Salón equipo', slug } });
      tenantId = tenant.id;
      await prisma.tenantSettings.create({ data: { tenantId } });
      ownerId = (await prisma.user.create({ data: { email: 'owner@t.com', password: hash, name: 'Dueña', role: 'OWNER', tenantId } })).id;
      await prisma.user.create({ data: { email: 'admin@t.com', password: hash, name: 'Gerente', role: 'ADMIN', tenantId } });
      proFree = (await prisma.professional.create({ data: { name: 'Ana', tenantId } })).id;
      otherTenantId = (await prisma.tenant.create({ data: { name: "Otro salón", slug: `${slug}-o` } })).id;
      await prisma.user.create({ data: { email: 'ajeno@t.com', password: hash, name: 'Ajeno', role: 'STAFF', tenantId: otherTenantId } });
    });
    tokens.owner = (await login('owner@t.com')).body.token;
    tokens.admin = (await login('admin@t.com')).body.token;
  });

  afterAll(async () => {
    await ctx.runAsAdmin(async () => {
      await prisma.tenant.delete({ where: { id: tenantId } });
      await prisma.tenant.delete({ where: { id: otherTenantId } });
    });
    await adminPool.end();
  });

  it('solo el dueño gestiona el equipo', async () => {
    expect((await request(app).get('/api/team').set(as('admin'))).status).toBe(403);
    expect((await request(app).post('/api/team').set(as('admin')).send({ name: 'x', email: 'x@t.com', role: 'ADMIN' })).status).toBe(403);
  });

  it('lista solo a las personas de su salón, con su profesional', async () => {
    const res = await request(app).get('/api/team').set(as('owner'));
    expect(res.status).toBe(200);
    expect(res.body.map((u: any) => u.email).sort()).toEqual(['admin@t.com', 'owner@t.com']);
    expect(res.body[0]).not.toHaveProperty('password');
  });

  it('crea un gerente con contraseña temporal que sirve para entrar', async () => {
    const res = await request(app).post('/api/team').set(as('owner')).send({ name: 'Luis', email: 'Luis@T.com', role: 'ADMIN' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'luis@t.com', role: 'ADMIN', isActive: true });
    expect(res.body.tempPassword).toHaveLength(12);
    expect(res.body.user).not.toHaveProperty('password');
    expect((await login('luis@t.com', res.body.tempPassword)).status).toBe(200);
  });

  it('un profesional necesita su ficha y no repite correo ni cuenta', async () => {
    expect((await request(app).post('/api/team').set(as('owner')).send({ name: 'Ana', email: 'ana@t.com', role: 'STAFF' })).status).toBe(400);
    expect((await request(app).post('/api/team').set(as('owner')).send({ name: 'Ana', email: 'ana@t.com', role: 'STAFF', professionalId: '00000000-0000-4000-8000-000000000000' })).status).toBe(400);
    expect((await request(app).post('/api/team').set(as('owner')).send({ name: 'Dup', email: 'admin@t.com', role: 'ADMIN' })).status).toBe(409);

    const ok = await request(app).post('/api/team').set(as('owner')).send({ name: 'Ana', email: 'ana@t.com', role: 'STAFF', professionalId: proFree });
    expect(ok.status).toBe(201);
    expect(ok.body.user.professional).toMatchObject({ id: proFree, name: 'Ana' });
    // la ficha ya tiene cuenta
    expect((await request(app).post('/api/team').set(as('owner')).send({ name: 'Ana2', email: 'ana2@t.com', role: 'STAFF', professionalId: proFree })).status).toBe(409);
    tokens.ana = (await login('ana@t.com', ok.body.tempPassword)).body.token;
    expect(tokens.ana).toBeTruthy();
  });

  it('restablecer la contraseña invalida la anterior y cierra sus sesiones', async () => {
    const id = (await request(app).get('/api/team').set(as('owner'))).body.find((u: any) => u.email === 'ana@t.com').id;
    const res = await request(app).post(`/api/team/${id}/reset-password`).set(as('owner'));
    expect(res.status).toBe(200);
    expect((await login('ana@t.com', res.body.tempPassword)).status).toBe(200);
    expect((await login('ana@t.com', 'secret123')).status).toBe(400);
  });

  it('desactivar corta el acceso y también marca inactivo al profesional; reactivar lo devuelve', async () => {
    const id = (await request(app).get('/api/team').set(as('owner'))).body.find((u: any) => u.email === 'ana@t.com').id;
    const off = await request(app).patch(`/api/team/${id}`).set(as('owner')).send({ isActive: false });
    expect(off.body.isActive).toBe(false);
    expect((await ctx.runAsAdmin(() => prisma.professional.findUnique({ where: { id: proFree } })))?.isActive).toBe(false);
    const row = await request(app).get('/api/team').set(as('owner'));
    expect(row.body.find((u: any) => u.id === id).isActive).toBe(false);
    await request(app).patch(`/api/team/${id}`).set(as('owner')).send({ isActive: true });
    expect((await ctx.runAsAdmin(() => prisma.professional.findUnique({ where: { id: proFree } })))?.isActive).toBe(true);
  });

  it('cambia el correo sin duplicar el de otra persona', async () => {
    const list = (await request(app).get('/api/team').set(as('owner'))).body;
    const id = list.find((u: any) => u.email === 'ana@t.com').id;
    expect((await request(app).patch(`/api/team/${id}`).set(as('owner')).send({ email: 'admin@t.com' })).status).toBe(409);
    const ok = await request(app).patch(`/api/team/${id}`).set(as('owner')).send({ email: 'ana.nueva@t.com' });
    expect(ok.body.email).toBe('ana.nueva@t.com');
  });

  it('el dueño no se toca y los usuarios de otro salón no existen', async () => {
    expect((await request(app).patch(`/api/team/${ownerId}`).set(as('owner')).send({ isActive: false })).status).toBe(403);
    expect((await request(app).delete(`/api/team/${ownerId}`).set(as('owner'))).status).toBe(403);
    const ajeno = await ctx.runAsAdmin(() => prisma.user.findFirst({ where: { tenantId: otherTenantId } }));
    expect((await request(app).patch(`/api/team/${ajeno!.id}`).set(as('owner')).send({ isActive: false })).status).toBe(404);
    expect((await request(app).post(`/api/team/${ajeno!.id}/reset-password`).set(as('owner'))).status).toBe(404);
  });

  it('elimina una cuenta sin historial y deja libre la ficha del profesional', async () => {
    const list = (await request(app).get('/api/team').set(as('owner'))).body;
    const id = list.find((u: any) => u.email === 'ana.nueva@t.com').id;
    expect((await request(app).delete(`/api/team/${id}`).set(as('owner'))).status).toBe(200);
    expect((await ctx.runAsAdmin(() => prisma.professional.findUnique({ where: { id: proFree } })))?.userId).toBeNull();
  });

  it('no elimina una cuenta que registró clientes: se desactiva', async () => {
    const list = (await request(app).get('/api/team').set(as('owner'))).body;
    const admin = list.find((u: any) => u.email === 'admin@t.com');
    await request(app).post('/api/clients').set(as('admin')).send({ name: 'Cli', email: 'cli@t.com' });
    const res = await request(app).delete(`/api/team/${admin.id}`).set(as('owner'));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Desactívala/);
  });
});
