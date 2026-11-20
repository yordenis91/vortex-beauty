import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

/**
 * Campanita del panel: novedades de reservas (nueva, cambio, cancelación),
 * quién las ve, no ver lo propio y el marcado como visto.
 */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

function mondayAfter(minDaysAhead: number, nth = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + minDaysAhead);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + 7 * nth);
  return d.toISOString().slice(0, 10);
}

describeIfDb('campanita: novedades de reservas', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let activity: typeof import('../services/activity');
  let app: import('express').Express;
  let tenantId: string;
  let otherTenantId: string;
  let slug: string;
  let serviceId: string;
  let proAId: string;
  let proBId: string;
  let clientId: string;
  const tokens: Record<string, string> = {};
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const feed = async (who: string, query: object = {}) => (await request(app).get('/api/activity').query(query).set(as(who))).body;
  const publicBook = (name: string, date: string, time: string, professionalId: string) =>
    request(app)
      .post(`/api/public/booking/${slug}/bookings`)
      .send({ serviceId, professionalId, date, startTime: time, customer: { name, email: `${name.toLowerCase().replace(/\W/g, '')}@example.com` } });
  const panelBook = (who: string, date: string, time: string, professionalId: string, extra: object = {}) =>
    request(app).post('/api/appointments').set(as(who)).send({ date, startTime: time, clientId, serviceId, professionalId, ...extra });

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    activity = await import('../services/activity');
    app = (await import('../app')).default;
    slug = `act-${Date.now().toString(36)}`;
    const hash = await bcrypt.hash('secret123', 4);
    await ctx.runAsAdmin(async () => {
      tenantId = (await prisma.tenant.create({ data: { name: 'Salón Campanita', slug, timezone: 'America/Bogota' } })).id;
      otherTenantId = (await prisma.tenant.create({ data: { name: 'Otro Salón', slug: `${slug}-otro`, timezone: 'America/Bogota' } })).id;
      await prisma.tenantSettings.create({ data: { tenantId, maxActivePerCustomer: 20 } });
      await prisma.tenantSettings.create({ data: { tenantId: otherTenantId } });
      const owner = await prisma.user.create({ data: { email: 'duena@act.com', password: hash, name: 'Dueña', role: 'OWNER', tenantId } });
      await prisma.user.create({ data: { email: 'admin@act.com', password: hash, name: 'Admin', role: 'ADMIN', tenantId } });
      const staffA = await prisma.user.create({ data: { email: 'staffa@act.com', password: hash, name: 'Staff A', role: 'STAFF', tenantId } });
      const staffB = await prisma.user.create({ data: { email: 'staffb@act.com', password: hash, name: 'Staff B', role: 'STAFF', tenantId } });
      await prisma.user.create({ data: { email: 'staffsin@act.com', password: hash, name: 'Sin perfil', role: 'STAFF', tenantId } });
      await prisma.user.create({ data: { email: 'otro@act.com', password: hash, name: 'Otro', role: 'OWNER', tenantId: otherTenantId } });
      const category = await prisma.category.create({ data: { name: 'Cortes', tenantId } });
      serviceId = (await prisma.service.create({ data: { name: 'Corte', price: 15, durationMinutes: 30, categoryId: category.id, userId: owner.id, tenantId } })).id;
      proAId = (await prisma.professional.create({ data: { name: 'Ana', tenantId, userId: staffA.id } })).id;
      proBId = (await prisma.professional.create({ data: { name: 'Bea', tenantId, userId: staffB.id } })).id;
      await prisma.professionalService.createMany({ data: [proAId, proBId].map((professionalId) => ({ tenantId, professionalId, serviceId })) });
      await prisma.businessHour.create({ data: { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', tenantId } });
      for (const professionalId of [proAId, proBId]) {
        await prisma.professionalSchedule.create({ data: { tenantId, professionalId, dayOfWeek: 1, startTime: '09:00', endTime: '18:00' } });
      }
      clientId = (await prisma.client.create({ data: { name: 'Clienta Panel', phone: '+57 300 111 2222', phoneKey: '573001112222', userId: owner.id, tenantId } })).id;
    });
    for (const [who, email, tenantSlug] of [
      ['owner', 'duena@act.com', slug],
      ['admin', 'admin@act.com', slug],
      ['staffA', 'staffa@act.com', slug],
      ['staffB', 'staffb@act.com', slug],
      ['staffSin', 'staffsin@act.com', slug],
      ['otro', 'otro@act.com', `${slug}-otro`],
    ] as const) {
      const res = await request(app).post('/api/auth/login').send({ tenantSlug, email, password: 'secret123' });
      tokens[who] = res.body.token;
    }
  });

  afterAll(async () => {
    await ctx.runAsAdmin(async () => {
      await prisma.tenant.delete({ where: { id: tenantId } });
      await prisma.tenant.delete({ where: { id: otherTenantId } });
    });
    await adminPool.end();
  });

  it('sin sesión: 401', async () => {
    expect((await request(app).get('/api/activity')).status).toBe(401);
    expect((await request(app).post('/api/activity/seen')).status).toBe(401);
  });

  it('una reserva de la clienta avisa al dueño, al admin y solo al profesional de la cita', async () => {
    const date = mondayAfter(3, 0);
    const res = await publicBook('Marta Pérez', date, '09:00', proAId);
    expect(res.status).toBe(201);

    for (const who of ['owner', 'admin', 'staffA']) {
      const body = await feed(who);
      const event = body.items.find((e: any) => e.clientName === 'Marta Pérez');
      expect(event, who).toBeTruthy();
      expect(event).toMatchObject({ kind: 'CREATED', actor: 'CUSTOMER', source: 'PUBLIC', serviceName: 'Corte', professionalName: 'Ana', unread: true });
      expect(body.unread).toBeGreaterThanOrEqual(1);
    }
    expect((await feed('staffB')).items.find((e: any) => e.clientName === 'Marta Pérez')).toBeUndefined();
    expect(await feed('staffSin')).toMatchObject({ items: [], unread: 0 });
  });

  it('lo que haces tú desde el panel no te avisa a ti, pero sí a los demás', async () => {
    const date = mondayAfter(3, 0);
    const res = await panelBook('owner', date, '10:00', proAId, { source: 'PAPEL' });
    expect(res.status).toBe(201);

    expect((await feed('owner')).items.find((e: any) => e.clientName === 'Clienta Panel')).toBeUndefined();
    const seenByAdmin = (await feed('admin')).items.find((e: any) => e.clientName === 'Clienta Panel');
    expect(seenByAdmin).toMatchObject({ kind: 'CREATED', actor: 'STAFF', source: 'PAPEL' });
    expect((await feed('staffA')).items.some((e: any) => e.clientName === 'Clienta Panel')).toBe(true);
  });

  it('cambio de hora por la clienta: novedad de cambio con la hora anterior', async () => {
    const date = mondayAfter(3, 1);
    const created = await publicBook('Lucía Gil', date, '11:00', proAId);
    const token = created.body.manageUrl.split('/').pop();
    const moved = await request(app).post(`/api/public/booking/${slug}/manage/${token}/reschedule`).send({ date, startTime: '12:00' });
    expect(moved.status).toBe(200);

    const events = (await feed('owner')).items.filter((e: any) => e.clientName === 'Lucía Gil');
    const change = events.find((e: any) => e.kind === 'RESCHEDULED');
    expect(change).toMatchObject({ actor: 'CUSTOMER', unread: true });
    expect(new Date(change.previousStartsAt).getTime()).toBeLessThan(new Date(change.startsAt).getTime());
  });

  it('cancelación por la clienta y por el salón', async () => {
    const date = mondayAfter(3, 1);
    const created = await publicBook('Rosa Díaz', date, '13:00', proBId);
    const token = created.body.manageUrl.split('/').pop();
    expect((await request(app).post(`/api/public/booking/${slug}/manage/${token}/cancel`).send({})).status).toBe(200);
    const byCustomer = (await feed('owner')).items.find((e: any) => e.clientName === 'Rosa Díaz' && e.kind === 'CANCELLED');
    expect(byCustomer).toMatchObject({ actor: 'CUSTOMER' });

    const booked = await panelBook('owner', date, '14:00', proBId);
    const cancel = await request(app).put(`/api/appointments/${booked.body.id}`).set(as('owner')).send({ status: 'CANCELLED' });
    expect(cancel.status).toBe(200);
    expect((await feed('owner')).items.some((e: any) => e.kind === 'CANCELLED' && e.clientName === 'Clienta Panel' && e.actor === 'STAFF')).toBe(false);
    expect((await feed('admin')).items.some((e: any) => e.kind === 'CANCELLED' && e.clientName === 'Clienta Panel' && e.actor === 'STAFF')).toBe(true);
    expect((await feed('staffB')).items.some((e: any) => e.kind === 'CANCELLED' && e.clientName === 'Clienta Panel')).toBe(true);
  });

  it('completar una cita no genera novedad', async () => {
    const date = mondayAfter(3, 2);
    const booked = await panelBook('owner', date, '09:00', proAId);
    const before = (await feed('admin')).items.length;
    await request(app).put(`/api/appointments/${booked.body.id}`).set(as('owner')).send({ status: 'COMPLETED' });
    expect((await feed('admin')).items.length).toBe(before);
  });

  it('«visto» pone el contador a cero y no retrocede; lo nuevo vuelve a contar', async () => {
    const before = await feed('admin');
    expect(before.unread).toBeGreaterThan(0);

    const seen = await request(app).post('/api/activity/seen').set(as('admin')).send({});
    expect(seen.status).toBe(200);
    const after = await feed('admin');
    expect(after.unread).toBe(0);
    expect(after.items.every((e: any) => e.unread === false)).toBe(true);

    // Marcar «visto» hasta una fecha antigua no vuelve a dejar nada sin ver.
    await request(app).post('/api/activity/seen').set(as('admin')).send({ upTo: '2020-01-01T00:00:00.000Z' });
    expect((await feed('admin')).unread).toBe(0);

    await publicBook('Nueva Clienta', mondayAfter(3, 2), '15:00', proAId);
    expect((await feed('admin')).unread).toBe(1);
    // Cada persona lleva su propio contador.
    expect((await feed('owner')).unread).toBeGreaterThan(0);
  });

  it('pagina con cursor', async () => {
    const first = await feed('admin', { limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();
    const second = await feed('admin', { limit: 2, before: first.nextCursor });
    expect(second.items.length).toBeGreaterThan(0);
    expect(second.items[0].id).not.toBe(first.items[0].id);
    expect(new Date(second.items[0].createdAt).getTime()).toBeLessThan(new Date(first.items[1].createdAt).getTime());
  });

  it('parámetros inválidos: 400', async () => {
    expect((await request(app).get('/api/activity').query({ limit: 500 }).set(as('owner'))).status).toBe(400);
    expect((await request(app).post('/api/activity/seen').set(as('owner')).send({ upTo: 'ayer' })).status).toBe(400);
  });

  it('no se mezclan salones', async () => {
    expect(await feed('otro')).toMatchObject({ items: [], unread: 0 });
  });

  it('las novedades de más de 60 días se borran', async () => {
    const old = new Date(Date.now() - 61 * 24 * 3600 * 1000);
    const created = await ctx.runAsAdmin(() =>
      prisma.appointmentEvent.create({
        data: { tenantId, kind: 'CREATED', actor: 'CUSTOMER', source: 'PUBLIC', clientName: 'Antigua', serviceName: 'Corte', startsAt: old, createdAt: old },
      })
    );
    expect(await activity.pruneOldEvents()).toBeGreaterThanOrEqual(1);
    const left = await ctx.runAsAdmin(() => prisma.appointmentEvent.findUnique({ where: { id: created.id } }));
    expect(left).toBeNull();
    expect((await feed('owner')).items.length).toBeGreaterThan(0);
  });
});
