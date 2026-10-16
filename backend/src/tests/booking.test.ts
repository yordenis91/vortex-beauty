import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

/**
 * Motor de disponibilidad y reservas contra Postgres real: zona horaria,
 * preparación/limpieza, varios profesionales, recursos, ausencias, tope diario
 * y, sobre todo, que dos reservas simultáneas nunca ocupen el mismo hueco.
 *
 * Salón en America/Bogota (UTC-5, sin horario de verano). El lunes
 * 2030-01-07 es un día laborable: las 09:00 locales son las 14:00 UTC.
 */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

const MONDAY = '2030-01-07';
const NEXT_MONDAY = '2030-01-14'; // día limpio, sin citas de otras pruebas
const TUESDAY = '2030-01-08';
const SUNDAY = '2030-01-06';

describeIfDb('motor de disponibilidad y reservas', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let engine: typeof import('../services/availability');
  let db: typeof import('../lib/db');

  let tenantId: string;
  let clientId: string;
  let userId: string;
  let categoryId: string;
  let p1: string; // Lunes 09:00-18:00
  let p2: string; // Lunes 09:00-12:00
  let svc60: string; // 60 min + 15 de limpieza
  let svcRes: string; // 60 min, requiere un recurso

  const inTenant = <T>(fn: () => T) => ctx.runWithTenant(tenantId, fn);
  const slots = async (serviceId: string, dateStr = MONDAY, professionalId?: string) =>
    inTenant(() => db.runInTransaction((tx) => engine.computeSlots(tx, { tenantId, dateStr, serviceId, professionalId })));
  const book = (serviceId: string, startTime: string, professionalId?: string | 'any', dateStr = MONDAY) =>
    inTenant(() => engine.createBooking({ tenantId, serviceId, clientId, dateStr, startTime, professionalId }));

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    engine = await import('../services/availability');
    db = await import('../lib/db');

    await ctx.runAsAdmin(async () => {
      const tenant = await prisma.tenant.create({
        data: { name: 'Salón de prueba', slug: `booking-${Date.now().toString(36)}`, timezone: 'America/Bogota' },
      });
      tenantId = tenant.id;
      await prisma.tenantSettings.create({ data: { tenantId } });
      const user = await prisma.user.create({
        data: { email: 'owner@test.com', password: 'x', name: 'Owner', role: 'OWNER', tenantId },
      });
      userId = user.id;
      const client = await prisma.client.create({ data: { name: 'Clienta', email: 'c@test.com', userId, tenantId } });
      clientId = client.id;
      categoryId = (await prisma.category.create({ data: { name: 'Servicios', tenantId } })).id;

      // Lunes abierto 09:00-18:00, domingo cerrado.
      await prisma.businessHour.createMany({
        data: [
          { dayOfWeek: 0, startTime: '09:00', endTime: '18:00', isOpen: false, tenantId },
          { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isOpen: true, tenantId },
          { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', isOpen: true, maxAppointments: 1, tenantId },
        ],
      });

      p1 = (await prisma.professional.create({ data: { name: 'Pro 1', tenantId } })).id;
      p2 = (await prisma.professional.create({ data: { name: 'Pro 2', tenantId } })).id;
      await prisma.professionalSchedule.createMany({
        data: [
          { tenantId, professionalId: p1, dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
          { tenantId, professionalId: p1, dayOfWeek: 2, startTime: '09:00', endTime: '18:00' },
          { tenantId, professionalId: p2, dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
        ],
      });

      const mk = (name: string, extra: object = {}) =>
        prisma.service.create({ data: { name, price: 20, durationMinutes: 60, categoryId, userId, tenantId, ...extra } });
      svc60 = (await mk('Servicio 60', { bufferAfterMin: 15 })).id;
      svcRes = (await mk('Servicio con recurso')).id;

      for (const serviceId of [svc60, svcRes]) {
        await prisma.professionalService.createMany({
          data: [p1, p2].map((professionalId) => ({ tenantId, professionalId, serviceId })),
        });
      }
      const room = await prisma.resource.create({ data: { name: 'Cabina 1', tenantId } });
      await prisma.serviceResource.create({ data: { tenantId, serviceId: svcRes, resourceId: room.id } });
    });
  });

  afterAll(async () => {
    await ctx.runAsAdmin(() => prisma.tenant.delete({ where: { id: tenantId } }));
    await adminPool.end();
  });

  it('ofrece huecos cada 30 min hasta que el servicio termina antes del cierre', async () => {
    const { slots: list } = await slots(svc60, MONDAY, p1);
    expect(list[0].startTime).toBe('09:00');
    expect(list[list.length - 1].startTime).toBe('17:00'); // 17:00 + 60 min = 18:00
    expect(list).toHaveLength(17);
  });

  it('convierte la hora local a instantes con la zona horaria del salón', async () => {
    const { slots: list } = await slots(svc60, MONDAY, p1);
    expect(list[0].startsAt.toISOString()).toBe('2030-01-07T14:00:00.000Z'); // 09:00 en UTC-5
    expect(list[0].endsAt.toISOString()).toBe('2030-01-07T15:00:00.000Z');
    expect(list[0].blockEndsAt.toISOString()).toBe('2030-01-07T15:15:00.000Z'); // + 15 min de limpieza
  });

  it('un día cerrado no ofrece huecos y explica el motivo', async () => {
    const result = await slots(svc60, SUNDAY, p1);
    expect(result.slots).toHaveLength(0);
    expect(result.reason).toMatch(/cerrado/);
  });

  it('solo ofrece al profesional las horas en las que trabaja', async () => {
    const { slots: list } = await slots(svc60, MONDAY, p2);
    // p2 trabaja 09:00-12:00: el último inicio posible es 11:00.
    expect(list[list.length - 1].startTime).toBe('11:00');
  });

  it('dos profesionales atienden a la vez; la tercera reserva del mismo hueco se rechaza', async () => {
    const a = await book(svc60, '10:00', 'any');
    const b = await book(svc60, '10:00', 'any');
    expect(new Set([a.professionalId, b.professionalId])).toEqual(new Set([p1, p2]));
    await expect(book(svc60, '10:00', 'any')).rejects.toThrow(/no está disponible/);
  });

  it('la limpieza bloquea los huecos siguientes del mismo profesional', async () => {
    // p1 ya tiene 10:00-11:00 (+15 de limpieza = 11:15). Pedir 11:00 a p1 falla, 11:30 funciona.
    await expect(book(svc60, '11:00', p1)).rejects.toThrow();
    const ok = await book(svc60, '11:30', p1);
    expect(ok.startTime).toBe('11:30');
    expect(ok.endTime).toBe('12:30');
  });

  it('la cita devuelve la hora local y congela precio, nombre y duración', async () => {
    const apt = await book(svc60, '14:00', p1);
    expect(apt.date).toBe('2030-01-07T00:00:00.000Z');
    expect(apt.startTime).toBe('14:00');
    expect(apt.serviceName).toBe('Servicio 60');
    expect(Number(apt.priceAmount)).toBe(20);
    expect(apt.durationMin).toBe(60);

    // Cambiar el precio del servicio no reescribe la cita ya reservada.
    await ctx.runAsAdmin(() => prisma.service.update({ where: { id: svc60 }, data: { price: 99, name: 'Renombrado' } }));
    const stored = await ctx.runAsAdmin(() => prisma.appointment.findUniqueOrThrow({ where: { id: apt.id } }));
    expect(Number(stored.priceAmount)).toBe(20);
    expect(stored.serviceName).toBe('Servicio 60');
    await ctx.runAsAdmin(() => prisma.service.update({ where: { id: svc60 }, data: { price: 20, name: 'Servicio 60' } }));
  });

  it('cancelar una cita libera el hueco', async () => {
    const apt = await book(svc60, '16:00', p1);
    await expect(book(svc60, '16:00', p1)).rejects.toThrow();
    await inTenant(() => engine.cancelBooking({ tenantId, id: apt.id, by: 'CUSTOMER' }));
    const again = await book(svc60, '16:00', p1);
    expect(again.startTime).toBe('16:00');
    const cancelled = await ctx.runAsAdmin(() => prisma.appointment.findUniqueOrThrow({ where: { id: apt.id } }));
    expect(cancelled.cancelledBy).toBe('CUSTOMER');
    expect(cancelled.cancelledAt).not.toBeNull();
  });

  it('reprogramar mueve la cita sin chocar consigo misma', async () => {
    const apt = await book(svc60, '09:00', p1, NEXT_MONDAY);
    const moved = await inTenant(() => engine.updateBooking({ tenantId, id: apt.id, startTime: '09:30' }));
    expect(moved.startTime).toBe('09:30');
    expect(moved.id).toBe(apt.id);
  });

  it('una ausencia del profesional bloquea sus horas', async () => {
    await ctx.runAsAdmin(() =>
      prisma.timeOff.create({
        data: { tenantId, professionalId: p2, startsAt: new Date('2030-01-07T14:00:00Z'), endsAt: new Date('2030-01-07T17:00:00Z') }, // 09:00-12:00 locales
      })
    );
    const { slots: list } = await slots(svc60, MONDAY, p2);
    expect(list).toHaveLength(0);
  });

  it('un servicio con recurso solo admite tantas citas simultáneas como recursos', async () => {
    const first = await book(svcRes, '13:00', 'any');
    expect(first.resourceId).not.toBeNull();
    // Hay dos profesionales libres a las 13:00 (p1 tiene 14:00), pero solo una cabina.
    await expect(book(svcRes, '13:00', 'any', MONDAY)).rejects.toThrow();
  });

  it('el tope diario de citas cierra el día', async () => {
    await book(svc60, '10:00', p1, TUESDAY);
    const result = await slots(svc60, TUESDAY, p1);
    expect(result.slots).toHaveLength(0);
    expect(result.reason).toMatch(/cupos/);
  });

  it('respeta la antelación mínima cuando se aplica la ventana de reserva', async () => {
    const now = new Date('2030-01-07T14:10:00Z'); // 09:10 locales del lunes
    const { slots: list } = await inTenant(() =>
      db.runInTransaction((tx) =>
        engine.computeSlots(tx, { tenantId, dateStr: MONDAY, serviceId: svcRes, professionalId: p1, enforceWindow: true, now })
      )
    );
    // minNoticeHours = 2 -> el primer hueco es a partir de las 11:10 locales.
    expect(list.every((s) => s.startTime >= '11:30')).toBe(true);
  });

  it('con 10 reservas simultáneas del mismo hueco, exactamente una se confirma', async () => {
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => book(svc60, '15:30', p1, NEXT_MONDAY)));
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(9);
    // Todos los rechazos son conflictos de reserva (409), no errores internos.
    for (const f of failed) {
      expect(engine.toBookingHttpError(f.reason)?.status).toBe(409);
    }
  });

  it('la base rechaza un solape aunque se salte el código de reservas (EXCLUDE)', async () => {
    const base = {
      tenantId,
      clientId,
      serviceId: svc60,
      professionalId: p1,
      serviceName: 'x',
      priceAmount: 1,
      durationMin: 60,
    };
    const times = (start: string, end: string) => ({
      startsAt: new Date(start),
      endsAt: new Date(end),
      blockStartsAt: new Date(start),
      blockEndsAt: new Date(end),
    });
    await ctx.runAsAdmin(() => prisma.appointment.create({ data: { ...base, ...times('2031-03-04T15:00:00Z', '2031-03-04T16:00:00Z') } }));
    const overlapping = ctx.runAsAdmin(() => prisma.appointment.create({ data: { ...base, ...times('2031-03-04T15:30:00Z', '2031-03-04T16:30:00Z') } }));
    await expect(overlapping).rejects.toThrow();
    await overlapping.catch((error) => expect(engine.isOverlapViolation(error)).toBe(true));

    // Citas contiguas (una termina cuando empieza la otra) sí se permiten.
    await ctx.runAsAdmin(() => prisma.appointment.create({ data: { ...base, ...times('2031-03-04T16:00:00Z', '2031-03-04T17:00:00Z') } }));
  });
});
