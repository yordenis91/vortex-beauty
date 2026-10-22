import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

/** Archivar clientes: se ocultan de las listas pero conservan su historial; se pueden restaurar. */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

describeIfDb('clientes archivados', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let app: import('express').Express;
  let tenantId: string;
  let otherTenantId: string;
  let owner: string;
  let staff: string;
  let maria: string;
  let luis: string;
  let ajeno: string;

  const as = (t: string) => ({ Authorization: `Bearer ${t}` });
  const list = async (query = '') => (await request(app).get(`/api/clients${query}`).set(as(owner))).body as Array<{ id: string; name: string }>;

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    app = (await import('../app')).default;
    const slug = `archivo-${Date.now().toString(36)}`;
    const hash = await bcrypt.hash('secret123', 4);
    await ctx.runAsAdmin(async () => {
      tenantId = (await prisma.tenant.create({ data: { name: 'Salón archivo', slug } })).id;
      otherTenantId = (await prisma.tenant.create({ data: { name: 'Otro', slug: `${slug}-o` } })).id;
      await prisma.tenantSettings.create({ data: { tenantId } });
      const ownerUser = await prisma.user.create({ data: { email: 'owner@a.com', password: hash, name: 'Dueña', role: 'OWNER', tenantId } });
      const staffUser = await prisma.user.create({ data: { email: 'staff@a.com', password: hash, name: 'Ana', role: 'STAFF', tenantId } });
      const otherOwner = await prisma.user.create({ data: { email: 'o@o.com', password: hash, name: 'Otra', role: 'OWNER', tenantId: otherTenantId } });
      const category = await prisma.category.create({ data: { name: 'S', tenantId } });
      const service = await prisma.service.create({ data: { name: 'Corte', price: 10, categoryId: category.id, userId: ownerUser.id, tenantId } });
      const pro = await prisma.professional.create({ data: { name: 'Ana', tenantId, userId: staffUser.id } });
      const mk = (name: string, phone: string, t = tenantId, userId = ownerUser.id) => prisma.client.create({ data: { name, phone, phoneKey: phone.replace(/\D/g, ''), userId, tenantId: t } });
      maria = (await mk('María Fernández', '+53 5 555 1001')).id;
      luis = (await mk('Luis Pérez', '+53 5 555 1002')).id;
      ajeno = (await mk('Cliente ajeno', '+53 5 999', otherTenantId, otherOwner.id)).id;
      const startsAt = new Date(Date.UTC(2031, 1, 10, 14));
      const endsAt = new Date(startsAt.getTime() + 3600000);
      await prisma.appointment.create({ data: { tenantId, clientId: maria, serviceId: service.id, professionalId: pro.id, status: 'COMPLETED', startsAt, endsAt, blockStartsAt: startsAt, blockEndsAt: endsAt, serviceName: 'Corte', priceAmount: 10, durationMin: 60, source: 'ADMIN' } });
    });
    const login = async (email: string) => (await request(app).post('/api/auth/login').send({ tenantSlug: slug, email, password: 'secret123' })).body.token as string;
    owner = await login('owner@a.com');
    staff = await login('staff@a.com');
  });

  afterAll(async () => {
    await ctx.runAsAdmin(async () => {
      await prisma.tenant.delete({ where: { id: tenantId } });
      await prisma.tenant.delete({ where: { id: otherTenantId } });
    });
    await adminPool.end();
  });

  it('archivar saca al cliente de la lista normal y lo muestra en la de archivados', async () => {
    expect((await list()).map((c) => c.name).sort()).toEqual(['Luis Pérez', 'María Fernández']);
    const res = await request(app).post(`/api/clients/${maria}/archive`).set(as(owner));
    expect(res.status).toBe(200);
    expect(res.body.archivedAt).toBeTruthy();
    expect((await list()).map((c) => c.name)).toEqual(['Luis Pérez']);
    expect((await list('?archived=true')).map((c) => c.name)).toEqual(['María Fernández']);
  });

  it('conserva su historial: las citas siguen ahí', async () => {
    const rows = await adminPool.query('SELECT count(*)::int AS n FROM "Appointment" WHERE "clientId" = $1', [maria]);
    expect(rows.rows[0].n).toBe(1);
  });

  it('un cliente archivado no se puede borrar y el mensaje sugiere archivar; uno sin citas sí', async () => {
    const blocked = await request(app).delete(`/api/clients/${maria}`).set(as(owner));
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toContain('archívalo');
    expect((await request(app).delete(`/api/clients/${luis}`).set(as(owner))).status).toBe(200);
  });

  it('no se puede agendar una cita nueva a un cliente archivado', async () => {
    const res = await request(app).post('/api/appointments').set(as(owner)).send({ date: '2031-02-11', startTime: '10:00', clientId: maria, serviceId: randomUUID() });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('archivado');
  });

  it('restaurar lo devuelve a la lista normal', async () => {
    const res = await request(app).post(`/api/clients/${maria}/restore`).set(as(owner));
    expect(res.status).toBe(200);
    expect(res.body.archivedAt).toBeNull();
    expect((await list()).map((c) => c.name)).toEqual(['María Fernández']);
    expect(await list('?archived=true')).toEqual([]);
  });

  it('un profesional no puede archivar ni restaurar', async () => {
    expect((await request(app).post(`/api/clients/${maria}/archive`).set(as(staff))).status).toBe(403);
    expect((await request(app).post(`/api/clients/${maria}/restore`).set(as(staff))).status).toBe(403);
  });

  it('no se puede archivar un cliente de otro salón ni uno inexistente', async () => {
    expect((await request(app).post(`/api/clients/${ajeno}/archive`).set(as(owner))).status).toBe(404);
    expect((await request(app).post(`/api/clients/${randomUUID()}/archive`).set(as(owner))).status).toBe(404);
    const rows = await adminPool.query('SELECT "archivedAt" FROM "Client" WHERE id = $1', [ajeno]);
    expect(rows.rows[0].archivedAt).toBeNull();
  });

  it('la búsqueda de la lista no devuelve archivados', async () => {
    await request(app).post(`/api/clients/${maria}/archive`).set(as(owner));
    expect(await list('?search=Mar')).toEqual([]);
    await request(app).post(`/api/clients/${maria}/restore`).set(as(owner));
  });
});
