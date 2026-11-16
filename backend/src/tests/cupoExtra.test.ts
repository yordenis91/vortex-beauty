import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

/**
 * Cupo extra: una hora más, solo para una fecha, para quien reserva por cupos.
 * Salón en America/Bogota. 2030-02-04 es lunes.
 */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

const MON = '2030-02-04';
const MON_NEXT = '2030-02-11';
const TUE = '2030-02-05'; // tope diario 1, sin cupos semanales
const WED = '2030-02-06'; // día cerrado en el horario general
const FRI = '2030-02-08'; // feriado

describeIfDb('cupos extra', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let engine: typeof import('../services/availability');
  let db: typeof import('../lib/db');
  let app: import('express').Express;

  let tenantId: string;
  let otherTenantId: string;
  let clientId: string;
  let quotaPro: string;
  let timedPro: string;
  let svc: string;
  let owner: string;
  let staff: string;
  let other: string;

  const inTenant = <T>(fn: () => T) => ctx.runWithTenant(tenantId, fn);
  const times = async (dateStr: string, professionalId = quotaPro) =>
    (await inTenant(() => db.runInTransaction((tx) => engine.computeSlots(tx, { tenantId, dateStr, serviceId: svc, professionalId })))).slots.map((s) => s.startTime);
  const book = (startTime: string, dateStr: string) =>
    inTenant(() => engine.createBooking({ tenantId, serviceId: svc, clientId, dateStr, startTime, professionalId: quotaPro }));
  const add = (token: string, body: object, id = quotaPro) => request(app).post(`/api/professionals/${id}/quota-extras`).set('Authorization', `Bearer ${token}`).send(body);
  const login = async (slug: string, email: string) => (await request(app).post('/api/auth/login').send({ tenantSlug: slug, email, password: 'secret123' })).body.token as string;

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    engine = await import('../services/availability');
    db = await import('../lib/db');
    app = (await import('../app')).default;
    const slug = `extra-${Date.now().toString(36)}`;
    const hash = await bcrypt.hash('secret123', 4);
    await ctx.runAsAdmin(async () => {
      tenantId = (await prisma.tenant.create({ data: { name: 'Salón extra', slug, timezone: 'America/Bogota' } })).id;
      otherTenantId = (await prisma.tenant.create({ data: { name: 'Otro', slug: `${slug}-o` } })).id;
      await prisma.tenantSettings.createMany({ data: [{ tenantId }, { tenantId: otherTenantId }] });
      const ownerUser = await prisma.user.create({ data: { email: 'owner@e.com', password: hash, name: 'Dueña', role: 'OWNER', tenantId } });
      await prisma.user.create({ data: { email: 'staff@e.com', password: hash, name: 'Ana', role: 'STAFF', tenantId } });
      await prisma.user.create({ data: { email: 'owner@o.com', password: hash, name: 'Otra', role: 'OWNER', tenantId: otherTenantId } });
      clientId = (await prisma.client.create({ data: { name: 'Clienta', email: 'c@e.com', userId: ownerUser.id, tenantId } })).id;
      const categoryId = (await prisma.category.create({ data: { name: 'Servicios', tenantId } })).id;
      await prisma.businessHour.createMany({
        data: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isOpen: true, tenantId },
          { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', isOpen: true, maxAppointments: 1, tenantId },
          { dayOfWeek: 3, startTime: '09:00', endTime: '18:00', isOpen: false, tenantId },
          { dayOfWeek: 5, startTime: '09:00', endTime: '18:00', isOpen: true, tenantId },
        ],
      });
      await prisma.closedDate.create({ data: { tenantId, date: FRI } });
      quotaPro = (await prisma.professional.create({ data: { name: 'Por cupos', bookingMode: 'QUOTA', tenantId } })).id;
      timedPro = (await prisma.professional.create({ data: { name: 'Por hora', tenantId } })).id;
      await prisma.professionalQuotaSlot.createMany({
        data: [
          { tenantId, professionalId: quotaPro, dayOfWeek: 1, time: '09:00' },
          { tenantId, professionalId: quotaPro, dayOfWeek: 1, time: '11:00' },
          { tenantId, professionalId: quotaPro, dayOfWeek: 3, time: '10:00' },
        ],
      });
      svc = (await prisma.service.create({ data: { name: 'Corte', price: 20, durationMinutes: 30, categoryId, userId: ownerUser.id, tenantId } })).id;
      await prisma.professionalService.createMany({ data: [quotaPro, timedPro].map((professionalId) => ({ tenantId, professionalId, serviceId: svc })) });
    });
    owner = await login(slug, 'owner@e.com');
    staff = await login(slug, 'staff@e.com');
    other = await login(`${slug}-o`, 'owner@o.com');
  });

  afterAll(async () => {
    await ctx.runAsAdmin(async () => {
      await prisma.tenant.delete({ where: { id: tenantId } });
      await prisma.tenant.delete({ where: { id: otherTenantId } });
    });
    await adminPool.end();
  });

  it('sin cupo extra, el día solo ofrece los cupos semanales', async () => {
    expect(await times(MON)).toEqual(['09:00', '11:00']);
  });

  it('un cupo extra aparece solo en su fecha, junto a los semanales', async () => {
    const res = await add(owner, { date: MON, time: '16:00' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ date: MON, time: '16:00' });
    expect(await times(MON)).toEqual(['09:00', '11:00', '16:00']);
    expect(await times(MON_NEXT)).toEqual(['09:00', '11:00']); // el lunes siguiente no cambia
  });

  it('se puede reservar una cita en el cupo extra, una sola vez', async () => {
    const appt = await book('16:00', MON);
    expect(appt.startTime).toBe('16:00');
    expect(await times(MON)).toEqual(['09:00', '11:00']);
    await expect(book('16:00', MON)).rejects.toThrow(/no está disponible/);
  });

  it('no deja quitar un cupo extra que tiene una cita, y sí uno libre', async () => {
    const list = await request(app).get(`/api/professionals/${quotaPro}/quota-extras`).query({ from: MON, to: MON }).set('Authorization', `Bearer ${owner}`);
    expect(list.status).toBe(200);
    const busy = list.body.find((x: any) => x.time === '16:00');
    expect((await request(app).delete(`/api/professionals/${quotaPro}/quota-extras/${busy.id}`).set('Authorization', `Bearer ${owner}`)).status).toBe(409);

    const free = await add(owner, { date: MON, time: '17:00' });
    expect(await times(MON)).toContain('17:00');
    expect((await request(app).delete(`/api/professionals/${quotaPro}/quota-extras/${free.body.id}`).set('Authorization', `Bearer ${owner}`)).status).toBe(200);
    expect(await times(MON)).not.toContain('17:00');
  });

  it('rechaza repetir un cupo semanal o un extra, a un profesional por hora, un día pasado y un feriado', async () => {
    expect((await add(owner, { date: MON, time: '09:00' })).status).toBe(409); // ya es cupo semanal
    expect((await add(owner, { date: MON, time: '16:00' })).status).toBe(409); // ya existe el extra
    expect((await add(owner, { date: MON, time: '10:00' }, timedPro)).status).toBe(409); // reserva por hora
    expect((await add(owner, { date: '2020-01-06', time: '10:00' })).status).toBe(409); // ya pasó
    expect((await add(owner, { date: FRI, time: '10:00' })).status).toBe(409); // feriado
    expect((await add(owner, { date: MON, time: '9am' })).status).toBe(400);
    expect((await add(owner, { date: '2030-13-45', time: '10:00' })).status).toBe(400);
  });

  it('solo quien administra el catálogo agrega; otro salón no ve ni toca los extras', async () => {
    expect((await add(staff, { date: MON_NEXT, time: '15:00' })).status).toBe(403);
    expect((await add(other, { date: MON_NEXT, time: '15:00' })).status).toBe(404);
    const list = await request(app).get(`/api/professionals/${quotaPro}/quota-extras`).set('Authorization', `Bearer ${other}`);
    expect(list.body).toEqual([]);
  });

  it('un día cerrado en el horario general se abre solo para quien tiene el extra', async () => {
    expect(await times(WED)).toEqual([]); // cerrado: ni su cupo semanal del miércoles
    await add(owner, { date: WED, time: '15:00' });
    expect(await times(WED)).toEqual(['15:00']);
    expect(await times(WED, timedPro)).toEqual([]); // quien reserva por hora sigue sin ese día
  });

  it('un feriado no ofrece cupos aunque ya existiera un extra', async () => {
    await ctx.runAsAdmin(() => prisma.professionalQuotaExtra.create({ data: { tenantId, professionalId: quotaPro, date: FRI, time: '10:00' } }));
    expect(await times(FRI)).toEqual([]);
  });

  it('el aviso «completo» cuenta los cupos extra libres', async () => {
    // Martes: tope 1 y sin cupos semanales. Con un extra ocupado el día se llena; con otro libre, no.
    await add(owner, { date: TUE, time: '10:00' });
    await book('10:00', TUE);
    const full = await request(app).get('/api/appointments/fully-booked-dates').set('Authorization', `Bearer ${owner}`);
    expect(full.body).toContain(TUE);
    await add(owner, { date: TUE, time: '12:00' });
    const open = await request(app).get('/api/appointments/fully-booked-dates').set('Authorization', `Bearer ${owner}`);
    expect(open.body).not.toContain(TUE);
  });
});
