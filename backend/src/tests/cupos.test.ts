import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

/**
 * Reserva por cupos: el profesional define horas exactas por día de la semana
 * y cada hora admite un solo cliente, sin importar la duración del servicio.
 *
 * Salón en America/Bogota (UTC-5). Lunes 2030-01-07, martes 2030-01-08.
 */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

const MONDAY = '2030-01-07';
const TUESDAY = '2030-01-08';

describeIfDb('reserva por cupos', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let engine: typeof import('../services/availability');
  let db: typeof import('../lib/db');
  let app: import('express').Express;

  let tenantId: string;
  let slug: string;
  let clientId: string;
  let userId: string;
  let quotaPro: string; // cupos lunes 09:00, 11:00, 14:00
  let timedPro: string; // por hora, lunes 09:00-18:00
  let svcLong: string; // 150 min
  let svcShort: string; // 30 min
  let token: string;

  const inTenant = <T>(fn: () => T) => ctx.runWithTenant(tenantId, fn);
  const slots = (serviceId: string, dateStr = MONDAY, professionalId?: string) =>
    inTenant(() => db.runInTransaction((tx) => engine.computeSlots(tx, { tenantId, dateStr, serviceId, professionalId })));
  const times = async (serviceId: string, dateStr = MONDAY, professionalId?: string) =>
    (await slots(serviceId, dateStr, professionalId)).slots.map((s) => s.startTime);
  const book = (serviceId: string, startTime: string, professionalId?: string | 'any', dateStr = MONDAY) =>
    inTenant(() => engine.createBooking({ tenantId, serviceId, clientId, dateStr, startTime, professionalId }));

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    engine = await import('../services/availability');
    db = await import('../lib/db');
    app = (await import('../app')).default;
    slug = `cupos-${Date.now().toString(36)}`;
    const hash = await bcrypt.hash('secret123', 4);

    await ctx.runAsAdmin(async () => {
      tenantId = (await prisma.tenant.create({ data: { name: 'Salón cupos', slug, timezone: 'America/Bogota' } })).id;
      await prisma.tenantSettings.create({ data: { tenantId } });
      userId = (await prisma.user.create({ data: { email: 'owner@c.com', password: hash, name: 'Dueña', role: 'OWNER', tenantId } })).id;
      clientId = (await prisma.client.create({ data: { name: 'Clienta', email: 'c@c.com', userId, tenantId } })).id;
      const categoryId = (await prisma.category.create({ data: { name: 'Servicios', tenantId } })).id;

      await prisma.businessHour.createMany({
        data: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isOpen: true, maxAppointments: 1, tenantId },
          { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', isOpen: true, tenantId },
        ],
      });

      quotaPro = (await prisma.professional.create({ data: { name: 'Por cupos', bookingMode: 'QUOTA', tenantId } })).id;
      timedPro = (await prisma.professional.create({ data: { name: 'Por hora', tenantId } })).id;
      await prisma.professionalQuotaSlot.createMany({
        data: ['09:00', '11:00', '14:00'].map((time) => ({ tenantId, professionalId: quotaPro, dayOfWeek: 1, time })),
      });
      await prisma.professionalSchedule.create({ data: { tenantId, professionalId: timedPro, dayOfWeek: 1, startTime: '09:00', endTime: '18:00' } });

      const mk = (name: string, durationMinutes: number, extra: object = {}) =>
        prisma.service.create({ data: { name, price: 20, durationMinutes, categoryId, userId, tenantId, ...extra } });
      svcLong = (await mk('Largo', 150, { bufferAfterMin: 30 })).id;
      svcShort = (await mk('Corto', 30)).id;
      for (const serviceId of [svcLong, svcShort]) {
        await prisma.professionalService.createMany({
          data: [quotaPro, timedPro].map((professionalId) => ({ tenantId, professionalId, serviceId })),
        });
      }
    });
    const res = await request(app).post('/api/auth/login').send({ tenantSlug: slug, email: 'owner@c.com', password: 'secret123' });
    token = res.body.token;
  });

  afterAll(async () => {
    await ctx.runAsAdmin(() => prisma.tenant.delete({ where: { id: tenantId } }));
    await adminPool.end();
  });

  it('ofrece solo las horas de los cupos, sin importar la duración del servicio', async () => {
    expect(await times(svcLong, MONDAY, quotaPro)).toEqual(['09:00', '11:00', '14:00']);
    expect(await times(svcShort, MONDAY, quotaPro)).toEqual(['09:00', '11:00', '14:00']);
  });

  it('un día sin cupos definidos no tiene disponibilidad', async () => {
    const result = await slots(svcShort, TUESDAY, quotaPro);
    expect(result.slots).toHaveLength(0);
  });

  it('un servicio largo ocupa un solo cupo y no bloquea el siguiente', async () => {
    const appt = await book(svcLong, '09:00', quotaPro);
    expect(appt.startTime).toBe('09:00');
    expect(appt.endTime).toBe('11:30'); // 150 min, solo informativo
    expect(await times(svcShort, MONDAY, quotaPro)).toEqual(['11:00', '14:00']);
    await book(svcShort, '11:00', quotaPro); // no choca con el servicio largo
    expect(await times(svcShort, MONDAY, quotaPro)).toEqual(['14:00']);
  });

  it('el aviso «completo» del calendario no marca un día con cupos libres aunque se alcance el tope del salón', async () => {
    // El lunes tiene tope 1 y ya hay 2 citas (09:00 y 11:00), pero queda libre el cupo de las 14:00.
    const res = await request(app).get('/api/appointments/fully-booked-dates').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).not.toContain(MONDAY)
  })

  it('el cupo ocupado no se puede reservar de nuevo', async () => {
    await expect(book(svcShort, '09:00', quotaPro)).rejects.toThrow(/no está disponible/);
  });

  it('cancelar una cita libera su cupo', async () => {
    const appt = await book(svcShort, '14:00', quotaPro);
    expect(await times(svcShort, MONDAY, quotaPro)).toEqual([]);
    await inTenant(() => engine.cancelBooking({ tenantId, id: appt.id, by: 'STAFF' }));
    expect(await times(svcShort, MONDAY, quotaPro)).toEqual(['14:00']);
  });

  it('con 10 reservas simultáneas del último cupo, exactamente una se confirma', async () => {
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => book(svcShort, '14:00', quotaPro)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('con todos los cupos ocupados y el tope alcanzado, el día sí aparece como completo', async () => {
    const res = await request(app).get('/api/appointments/fully-booked-dates').set('Authorization', `Bearer ${token}`)
    expect(res.body).toContain(MONDAY)
  })

  it('el tope diario del salón (1) corta a quien reserva por hora, no a quien reserva por cupos', async () => {
    // El lunes ya tiene varias citas y el salón admite 1: el profesional por hora no tiene huecos.
    // (Los cupos libres siguieron ofreciéndose arriba con ese mismo tope superado.)
    expect(await times(svcShort, MONDAY, timedPro)).toEqual([]);
  });

  it('mezcla profesionales por hora y por cupos para "cualquiera"', async () => {
    // Martes: sin tope. Cupo del martes para el profesional por cupos.
    await ctx.runAsAdmin(async () => {
      await prisma.professionalQuotaSlot.create({ data: { tenantId, professionalId: quotaPro, dayOfWeek: 2, time: '10:00' } });
      await prisma.professionalSchedule.create({ data: { tenantId, professionalId: timedPro, dayOfWeek: 2, startTime: '09:00', endTime: '12:00' } });
    });
    const list = await times(svcShort, TUESDAY);
    expect(list).toContain('10:00');
    expect(list).toContain('09:00'); // por hora
    expect(list.filter((t) => t === '10:00')).toHaveLength(1); // sin duplicados
    const slot = (await slots(svcShort, TUESDAY)).slots.find((s) => s.startTime === '10:00')!;
    expect(slot.professionalIds).toEqual(expect.arrayContaining([quotaPro, timedPro]));
    const appt = await book(svcShort, '10:00', quotaPro, TUESDAY);
    expect(appt.professionalId).toBe(quotaPro);
    // El profesional por hora sigue libre a esa misma hora.
    const other = await book(svcShort, '10:00', timedPro, TUESDAY);
    expect(other.professionalId).toBe(timedPro);
  });

  it('la cita de cupo bloquea solo su minuto en la base', async () => {
    const rows = await adminPool.query(
      `SELECT "blockStartsAt", "blockEndsAt", "startsAt" FROM "Appointment" WHERE "professionalId" = $1 AND "startsAt" = $2`,
      [quotaPro, '2030-01-07T14:00:00.000Z']
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].blockEndsAt.getTime() - rows.rows[0].blockStartsAt.getTime()).toBe(60_000);
  });

  it('la base rechaza dos citas en el mismo cupo (EXCLUDE)', async () => {
    await expect(
      adminPool.query(
        `INSERT INTO "Appointment" (id, "tenantId", "clientId", "serviceId", "professionalId", status, "startsAt", "endsAt", "blockStartsAt", "blockEndsAt",
           "serviceName", "priceAmount", "durationMin", source, "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'SCHEDULED', $5, $5, $5, $6, 'x', 1, 30, 'ADMIN', now())`,
        [tenantId, clientId, svcShort, quotaPro, '2030-01-07T14:00:00.000Z', '2030-01-07T14:01:00.000Z']
      )
    ).rejects.toThrow(/appointment_no_overlap_professional/);
  });

  describe('API de profesionales', () => {
    const auth = () => ({ Authorization: `Bearer ${token}` });

    it('guarda el modo y los cupos y los devuelve ordenados', async () => {
      const res = await request(app)
        .put(`/api/professionals/${quotaPro}`)
        .set(auth())
        .send({
          bookingMode: 'QUOTA',
          quotaSlots: [
            { dayOfWeek: 1, time: '09:00' },
            { dayOfWeek: 1, time: '11:00' },
            { dayOfWeek: 1, time: '14:00' },
            { dayOfWeek: 3, time: '16:00' },
            { dayOfWeek: 2, time: '10:00' },
          ],
        });
      expect(res.status).toBe(200);
      expect(res.body.bookingMode).toBe('QUOTA');
      expect(res.body.quotaSlots.map((q: any) => `${q.dayOfWeek}|${q.time}`)).toEqual(['1|09:00', '1|11:00', '1|14:00', '2|10:00', '3|16:00']);
    });

    it('rechaza cupos repetidos y horas inválidas', async () => {
      const dup = await request(app).put(`/api/professionals/${quotaPro}`).set(auth()).send({ quotaSlots: [{ dayOfWeek: 1, time: '09:00' }, { dayOfWeek: 1, time: '09:00' }] });
      expect(dup.status).toBe(400);
      const bad = await request(app).put(`/api/professionals/${quotaPro}`).set(auth()).send({ quotaSlots: [{ dayOfWeek: 1, time: '9am' }] });
      expect(bad.status).toBe(400);
    });

    it('no deja quitar un cupo que tiene una cita futura', async () => {
      const res = await request(app)
        .put(`/api/professionals/${quotaPro}`)
        .set(auth())
        .send({ quotaSlots: [{ dayOfWeek: 1, time: '09:00' }, { dayOfWeek: 1, time: '14:00' }] }); // quita 11:00, ocupado
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/2030-01-07 11:00/);
      const still = await request(app).get(`/api/professionals/${quotaPro}`).set(auth());
      expect(still.body.quotaSlots).toHaveLength(5);
    });

    it('permite quitar un cupo libre', async () => {
      const res = await request(app)
        .put(`/api/professionals/${quotaPro}`)
        .set(auth())
        .send({ quotaSlots: [{ dayOfWeek: 1, time: '09:00' }, { dayOfWeek: 1, time: '11:00' }, { dayOfWeek: 1, time: '14:00' }, { dayOfWeek: 2, time: '10:00' }] });
      expect(res.status).toBe(200);
      expect(res.body.quotaSlots).toHaveLength(4);
    });

    it('por defecto un profesional nuevo reserva por hora', async () => {
      const res = await request(app).post('/api/professionals').set(auth()).send({ name: 'Nuevo' });
      expect(res.status).toBe(201);
      expect(res.body.bookingMode).toBe('TIMED');
      expect(res.body.quotaSlots).toEqual([]);
    });
  });
});
