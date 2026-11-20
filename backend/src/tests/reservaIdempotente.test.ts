import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

/**
 * Reserva pública idempotente: si la respuesta se pierde por la conexión y la clienta reintenta,
 * recibe la reserva que ya hizo (200) en lugar de «ese hueco ya no está disponible»; sin repetir avisos.
 */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

function mondayAfter(minDaysAhead: number, nth = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + minDaysAhead);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + 7 * nth);
  return d.toISOString().slice(0, 10);
}

describeIfDb('reserva pública idempotente', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let app: import('express').Express;
  let queue: typeof import('../lib/queue');
  let captcha: typeof import('../services/captcha');
  let tenantId: string;
  let slug: string;
  let serviceId: string;
  let proAId: string;
  let proBId: string;
  let week = 0;

  const book = (date: string, startTime: string, over: Record<string, unknown> = {}, customer: Record<string, unknown> = {}) =>
    request(app)
      .post(`/api/public/booking/${slug}/bookings`)
      .send({ serviceId, professionalId: 'any', date, startTime, customer: { name: 'Marta Pérez', email: 'marta@example.com', ...customer }, ...over });
  const rows = (where: object = {}) => ctx.runAsAdmin(() => prisma.appointment.findMany({ where: { tenantId, ...where } }));
  const confirmations = () => queue.getMemoryJobs().filter((j) => j.name === 'booking.confirmed');

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    app = (await import('../app')).default;
    queue = await import('../lib/queue');
    captcha = await import('../services/captcha');
    slug = `idem-${Date.now().toString(36)}`;
    await ctx.runAsAdmin(async () => {
      tenantId = (await prisma.tenant.create({ data: { name: 'Salón Idempotente', slug, timezone: 'America/Bogota' } })).id;
      await prisma.tenantSettings.create({ data: { tenantId, maxActivePerCustomer: 2 } });
      const owner = await prisma.user.create({ data: { email: 'dueno@idem.com', password: await bcrypt.hash('x', 4), name: 'Dueño', role: 'OWNER', tenantId } });
      const category = await prisma.category.create({ data: { name: 'Cortes', tenantId } });
      serviceId = (await prisma.service.create({ data: { name: 'Corte', price: 15, durationMinutes: 30, categoryId: category.id, userId: owner.id, tenantId } })).id;
      proAId = (await prisma.professional.create({ data: { name: 'Ana', tenantId } })).id;
      proBId = (await prisma.professional.create({ data: { name: 'Bea', tenantId } })).id;
      for (const professionalId of [proAId, proBId]) {
        await prisma.professionalService.create({ data: { tenantId, professionalId, serviceId } });
        await prisma.professionalSchedule.create({ data: { tenantId, professionalId, dayOfWeek: 1, startTime: '09:00', endTime: '18:00' } });
      }
      await prisma.businessHour.create({ data: { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', tenantId } });
    });
  });

  afterAll(async () => {
    captcha.setCaptchaVerifier(null);
    await ctx.runAsAdmin(() => prisma.tenant.delete({ where: { id: tenantId } }));
    await adminPool.end();
  });

  beforeEach(() => {
    queue.clearMemoryJobs();
    captcha.setCaptchaVerifier(null);
  });

  it('el reintento de una reserva ya hecha devuelve la misma (200), sin duplicar la cita ni los avisos', async () => {
    const date = mondayAfter(3, week++ % 8);
    const first = await book(date, '09:00');
    expect(first.status).toBe(201);
    expect(confirmations()).toHaveLength(1);

    const retry = await book(date, '09:00');
    expect(retry.status).toBe(200);
    expect(retry.body.id).toBe(first.body.id);
    expect(retry.body.manageUrl).toBe(first.body.manageUrl);
    expect(retry.body.startTime).toBe('09:00');
    expect(retry.body).toHaveProperty('telegram');

    expect(await rows({ clientId: (await rows({ id: first.body.id }))[0].clientId })).toHaveLength(1);
    expect(confirmations()).toHaveLength(1); // no hay segunda confirmación
  });

  it('el reintento no cuenta contra el tope de reservas pendientes', async () => {
    const date = mondayAfter(3, week++ % 8);
    const who = { name: 'Lucía Gil', email: 'lucia@example.com' };
    expect((await book(date, '10:00', {}, who)).status).toBe(201);
    expect((await book(date, '11:00', {}, who)).status).toBe(201); // ya tiene 2 = el tope
    const retry = await book(date, '11:00', {}, who);
    expect(retry.status).toBe(200); // no 429
    expect((await book(date, '12:00', {}, who)).status).toBe(429); // una tercera distinta sí se frena
  });

  it('otra persona que pide el mismo hueco sigue recibiendo «no disponible» (409)', async () => {
    const date = mondayAfter(3, week++ % 8);
    // Con un solo profesional libre en ese hueco ocupado por otra persona
    const a = await book(date, '09:00', { professionalId: proAId }, { name: 'Rosa Paz', email: 'rosa@example.com' });
    expect(a.status).toBe(201);
    const other = await book(date, '09:00', { professionalId: proAId }, { name: 'Ana López', email: 'ana@example.com' });
    expect(other.status).toBe(409);
  });

  it('con el mismo correo pero otro nombre no se le entrega la reserva de otra persona', async () => {
    const date = mondayAfter(3, week++ % 8);
    const mine = await book(date, '09:30', { professionalId: proAId }, { name: 'Elena Ruiz', email: 'elena@example.com' });
    expect(mine.status).toBe(201);
    const intruder = await book(date, '09:30', { professionalId: proAId }, { name: 'Otra Persona', email: 'elena@example.com' });
    expect(intruder.status).toBe(409);
    expect(JSON.stringify(intruder.body)).not.toContain(mine.body.manageUrl);
  });

  it('el nombre se compara sin importar mayúsculas ni espacios de más', async () => {
    const date = mondayAfter(3, week++ % 8);
    const first = await book(date, '13:00', {}, { name: 'Carmen Vega', email: 'carmen@example.com' });
    const retry = await book(date, '13:00', {}, { name: '  carmen   VEGA ', email: 'carmen@example.com' });
    expect(retry.status).toBe(200);
    expect(retry.body.id).toBe(first.body.id);
  });

  it('con un profesional concreto, el reintento debe pedir el mismo', async () => {
    const date = mondayAfter(3, week++ % 8);
    const who = { name: 'Nuria Sanz', email: 'nuria@example.com' };
    const first = await book(date, '14:00', { professionalId: proAId }, who);
    expect(first.status).toBe(201);
    expect((await book(date, '14:00', { professionalId: proAId }, who)).body.id).toBe(first.body.id);
    // Pide a otra profesional a esa misma hora: no es el mismo envío (y ese hueco está libre: reserva nueva).
    const other = await book(date, '14:00', { professionalId: proBId }, who);
    expect(other.status).toBe(201);
    expect(other.body.id).not.toBe(first.body.id);
  });

  it('una reserva de hace más de 10 minutos ya no se toma por un reintento', async () => {
    const date = mondayAfter(3, week++ % 8);
    const who = { name: 'Paula Mora', email: 'paula@example.com' };
    const first = await book(date, '15:00', { professionalId: proAId }, who);
    await ctx.runAsAdmin(() => prisma.appointment.update({ where: { id: first.body.id }, data: { createdAt: new Date(Date.now() - 11 * 60_000) } }));
    expect((await book(date, '15:00', { professionalId: proAId }, who)).status).toBe(409);
  });

  it('una reserva cancelada no se devuelve: el hueco queda libre y se crea una nueva', async () => {
    const date = mondayAfter(3, week++ % 8);
    const who = { name: 'Sara Gil', email: 'sara@example.com' };
    const first = await book(date, '16:00', { professionalId: proAId }, who);
    const token = first.body.manageUrl.split('/').pop();
    expect((await request(app).post(`/api/public/booking/${slug}/manage/${token}/cancel`).send({})).status).toBe(200);
    const again = await book(date, '16:00', { professionalId: proAId }, who);
    expect(again.status).toBe(201);
    expect(again.body.id).not.toBe(first.body.id);
  });

  it('dos envíos iguales a la vez (doble toque) dejan una sola reserva y los dos reciben la misma', async () => {
    const date = mondayAfter(3, week++ % 8);
    const who = { name: 'Irene Cano', email: 'irene@example.com' };
    const [a, b] = await Promise.all([book(date, '17:00', { professionalId: proBId }, who), book(date, '17:00', { professionalId: proBId }, who)]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body.id).toBe(b.body.id);
    expect(await rows({ professionalId: proBId, serviceName: 'Corte', client: { email: 'irene@example.com' } })).toHaveLength(1);
    expect(confirmations().filter((j) => (j.data as { appointmentId: string }).appointmentId === a.body.id)).toHaveLength(1);
  });

  it('la verificación anti-bots se exige también en el reintento (no es una puerta trasera)', async () => {
    const date = mondayAfter(3, week++ % 8);
    const who = { name: 'Julia Rey', email: 'julia@example.com' };
    expect((await book(date, '09:00', { professionalId: proBId }, who)).status).toBe(201);
    captcha.setCaptchaVerifier(async () => false);
    const retry = await book(date, '09:00', { professionalId: proBId }, who);
    expect(retry.status).toBe(400);
    expect(retry.body.error).toMatch(/verificar/);
  });

  it('una reserva nueva normal sigue devolviendo 201', async () => {
    const res = await book(mondayAfter(3, week++ % 8), '11:30', {}, { name: 'Nueva Clienta', email: 'nueva@example.com' });
    expect(res.status).toBe(201);
  });
});
