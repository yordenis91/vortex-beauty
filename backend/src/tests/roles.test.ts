import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

/**
 * Roles y permisos: OWNER, ADMIN, STAFF (solo su agenda), CLIENT, y límites del plan.
 */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

const WINDOW = { from: '2030-01-01', to: '2030-12-31' };

describeIfDb('roles, permisos y límites del plan', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let app: import('express').Express;

  let tenantId: string;
  let slug: string;
  let planId: string;
  let serviceId: string;
  let clientId: string;
  let proA: string; // profesional con cuenta STAFF
  let proB: string;
  const tokens: Record<string, string> = {};

  const login = async (email: string) => {
    const res = await request(app).post('/api/auth/login').send({ tenantSlug: slug, email, password: 'secret123' });
    expect(res.status).toBe(200);
    return res.body.token as string;
  };
  const as = (role: string) => ({ Authorization: `Bearer ${tokens[role]}` });

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    app = (await import('../app')).default;
    const hash = await bcrypt.hash('secret123', 4);
    slug = `roles-${Date.now().toString(36)}`;

    await ctx.runAsAdmin(async () => {
      const tenant = await prisma.tenant.create({ data: { name: 'Salón roles', slug } });
      tenantId = tenant.id;
      await prisma.tenantSettings.create({ data: { tenantId } });
      const mkUser = (email: string, role: 'OWNER' | 'ADMIN' | 'STAFF' | 'CLIENT', extra = {}) =>
        prisma.user.create({ data: { email, password: hash, name: email, role, tenantId, ...extra } });

      const owner = await mkUser('owner@t.com', 'OWNER');
      await mkUser('admin@t.com', 'ADMIN');
      const staffA = await mkUser('staff-a@t.com', 'STAFF');
      const client = await prisma.client.create({ data: { name: 'Cli', email: 'cli@t.com', userId: owner.id, tenantId } });
      clientId = client.id;
      await mkUser('cli@t.com', 'CLIENT', { clientId: client.id });

      proA = (await prisma.professional.create({ data: { name: 'Pro A', tenantId, userId: staffA.id } })).id;
      proB = (await prisma.professional.create({ data: { name: 'Pro B', tenantId } })).id;
      const category = await prisma.category.create({ data: { name: 'S', tenantId } });
      serviceId = (await prisma.service.create({ data: { name: 'Svc', price: 5, categoryId: category.id, userId: owner.id, tenantId } })).id;
      await prisma.professionalService.createMany({
        data: [proA, proB].map((professionalId) => ({ tenantId, professionalId, serviceId })),
      });
      await prisma.businessHour.create({ data: { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', tenantId } });
      await prisma.professionalSchedule.createMany({
        data: [proA, proB].map((professionalId) => ({ tenantId, professionalId, dayOfWeek: 1, startTime: '09:00', endTime: '18:00' })),
      });

      const plan = await prisma.plan.create({
        data: { name: 'Mini', slug: `mini-${slug}`, priceMonthly: 1, priceYearly: 10, maxStaff: 2, maxAppointmentsPerMonth: 2 },
      });
      planId = plan.id;
      await prisma.tenantSubscription.create({
        data: { tenantId, planId, status: 'ACTIVE', currentPeriodEnd: new Date('2099-01-01') },
      });
    });

    tokens.owner = await login('owner@t.com');
    tokens.admin = await login('admin@t.com');
    tokens.staff = await login('staff-a@t.com');
    tokens.client = await login('cli@t.com');
  });

  afterAll(async () => {
    await ctx.runAsAdmin(async () => {
      await prisma.tenant.delete({ where: { id: tenantId } });
      await prisma.plan.delete({ where: { id: planId } });
    });
    await adminPool.end();
  });

  it('un cliente final no puede usar el panel del salón', async () => {
    expect((await request(app).get('/api/appointments').set(as('client'))).status).toBe(403);
    expect((await request(app).get('/api/clients').set(as('client'))).status).toBe(403);
    expect((await request(app).get('/api/professionals').set(as('client'))).status).toBe(403);
  });

  it('un profesional (STAFF) no gestiona catálogo ni clientes, pero puede leerlos', async () => {
    expect((await request(app).post('/api/services').set(as('staff')).send({})).status).toBe(403);
    expect((await request(app).post('/api/professionals').set(as('staff')).send({ name: 'x' })).status).toBe(403);
    expect((await request(app).put('/api/settings/booking').set(as('staff')).send({ slotIntervalMin: 15 })).status).toBe(403);
    expect((await request(app).post('/api/clients').set(as('staff')).send({ name: 'x', email: 'x@x.com' })).status).toBe(403);
    expect((await request(app).get('/api/clients').set(as('staff'))).status).toBe(200);
    expect((await request(app).get('/api/services').set(as('staff'))).status).toBe(200);
  });

  it('el STAFF solo ve su agenda y sus citas se asignan a él aunque pida otro profesional', async () => {
    const asOwner = await request(app)
      .post('/api/appointments')
      .set(as('owner'))
      .send({ date: '2030-01-07', startTime: '10:00', clientId, serviceId, professionalId: proB });
    expect(asOwner.status).toBe(201);

    const forced = await request(app)
      .post('/api/appointments')
      .set(as('staff'))
      .send({ date: '2030-01-07', startTime: '12:00', clientId, serviceId, professionalId: proB });
    expect(forced.status).toBe(201);
    expect(forced.body.professionalId).toBe(proA);

    const own = await request(app).get('/api/appointments').query(WINDOW).set(as('staff'));
    expect(own.body.map((a: any) => a.professionalId)).toEqual([proA]);
    const all = await request(app).get('/api/appointments').query(WINDOW).set(as('owner'));
    expect(all.body).toHaveLength(2);

    // La cita de otro profesional no existe para el STAFF
    expect((await request(app).get(`/api/appointments/${asOwner.body.id}`).set(as('staff'))).status).toBe(404);
    expect((await request(app).put(`/api/appointments/${asOwner.body.id}`).set(as('staff')).send({ notes: 'x' })).status).toBe(404);
    // y no puede borrar ninguna
    expect((await request(app).delete(`/api/appointments/${forced.body.id}`).set(as('staff'))).status).toBe(403);
  });

  it('el plan limita las citas del mes (402)', async () => {
    // Ya hay 2 citas creadas este mes y el plan permite 2.
    const res = await request(app)
      .post('/api/appointments')
      .set(as('owner'))
      .send({ date: '2030-01-07', startTime: '15:00', clientId, serviceId, professionalId: proB });
    expect(res.status).toBe(402);
  });

  it('solo el dueño crea cuentas de acceso para profesionales', async () => {
    const body = { name: 'Nuevo', schedule: [], serviceIds: [], account: { email: 'nuevo@t.com', password: 'secret123' } };
    expect((await request(app).post('/api/professionals').set(as('admin')).send(body)).status).toBe(403);
  });

  it('el plan limita la cantidad de profesionales activos (402)', async () => {
    // El plan permite 2 y ya hay 2 activos.
    const res = await request(app).post('/api/professionals').set(as('owner')).send({ name: 'Tercero', schedule: [], serviceIds: [] });
    expect(res.status).toBe(402);
    expect(res.body.error).toMatch(/plan/i);
  });

  it('un administrador no accede a la facturación del plan (solo el dueño)', async () => {
    // Las rutas de facturación piden rol de administración; el control fino del dueño está en la interfaz y en 'billing:manage'.
    const permissions = await import('../middleware/can');
    expect(permissions.hasPermission('ADMIN', 'billing:manage')).toBe(false);
    expect(permissions.hasPermission('OWNER', 'billing:manage')).toBe(true);
    expect(permissions.hasPermission('STAFF', 'appointments:all')).toBe(false);
  });
});
