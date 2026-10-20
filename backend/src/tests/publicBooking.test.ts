import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

/**
 * Reserva pública sin cuenta, enlace de gestión, avisos y recordatorios.
 * Correos y Telegram se sustituyen por emisores falsos; la cola va en memoria.
 */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

// Las reservas públicas solo admiten fechas dentro de la ventana (60 días): se usan lunes cercanos.
function mondayAfter(minDaysAhead: number, nth = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + minDaysAhead);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + 7 * nth);
  return d.toISOString().slice(0, 10);
}

describeIfDb('reserva pública y avisos', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let app: import('express').Express;
  let queue: typeof import('../lib/queue');
  let notifier: typeof import('../services/notifications/notifier');
  let emailChannel: typeof import('../services/channels/email');
  let telegramChannel: typeof import('../services/channels/telegram');
  let captcha: typeof import('../services/captcha');

  let tenantId: string;
  let slug: string;
  let serviceId: string;
  let proId: string;
  let privateServiceId: string;
  const sentEmails: Array<{ to: string; subject: string; text: string; html?: string }> = [];
  const sentTelegram: Array<{ chatId: string; text: string }> = [];
  let weekOffset = 0;

  // Cada prueba usa un lunes distinto (a partir de 3 días vista) para no pisarse con las demás.
  const nextMonday = () => mondayAfter(3, weekOffset++ % 5);

  const book = (body: object) => request(app).post(`/api/public/booking/${slug}/bookings`).send(body);
  const validBody = (date: string, startTime = '10:00', extra: object = {}) => ({
    serviceId,
    professionalId: 'any',
    date,
    startTime,
    customer: { name: 'Marta Pérez', phone: '+53 5 555 1234', email: 'marta@example.com' },
    ...extra,
  });
  const tokenOf = (manageUrl: string) => manageUrl.split('/').pop()!;

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    app = (await import('../app')).default;
    queue = await import('../lib/queue');
    notifier = await import('../services/notifications/notifier');
    emailChannel = await import('../services/channels/email');
    telegramChannel = await import('../services/channels/telegram');
    captcha = await import('../services/captcha');

    emailChannel.setEmailSender(async (m) => {
      sentEmails.push(m);
      return { ok: true };
    });
    telegramChannel.setTelegramSender(async (_token, chatId, text) => {
      sentTelegram.push({ chatId, text });
      return { ok: true };
    });

    slug = `pub-${Date.now().toString(36)}`;
    await ctx.runAsAdmin(async () => {
      const tenant = await prisma.tenant.create({ data: { name: 'Salón Público', slug, timezone: 'America/Bogota' } });
      tenantId = tenant.id;
      await prisma.tenantSettings.create({
        data: {
          tenantId,
          labels: { appointment: 'turno' },
          cancelWindowHrs: 12,
          maxActivePerCustomer: 2,
          telegramBotToken: 'bot-token',
          telegramChatId: '999',
        },
      });
      const owner = await prisma.user.create({
        data: { email: 'dueno@pub.com', password: await bcrypt.hash('x', 4), name: 'Dueño', role: 'OWNER', tenantId },
      });
      const category = await prisma.category.create({ data: { name: 'Cortes', tenantId } });
      const mk = (name: string, extra: object = {}) =>
        prisma.service.create({ data: { name, price: 15, durationMinutes: 30, categoryId: category.id, userId: owner.id, tenantId, ...extra } });
      serviceId = (await mk('Corte')).id;
      privateServiceId = (await mk('Servicio interno', { onlineBookable: false })).id;
      const pro = await prisma.professional.create({ data: { name: 'Carlos', tenantId } });
      proId = pro.id;
      await prisma.professionalService.createMany({
        data: [serviceId, privateServiceId].map((sid) => ({ tenantId, professionalId: pro.id, serviceId: sid })),
      });
      await prisma.businessHour.create({ data: { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', tenantId } });
      await prisma.professionalSchedule.create({ data: { tenantId, professionalId: pro.id, dayOfWeek: 1, startTime: '09:00', endTime: '18:00' } });
    });
  });

  afterAll(async () => {
    emailChannel.setEmailSender(null);
    telegramChannel.setTelegramSender(null);
    captcha.setCaptchaVerifier(null);
    await ctx.runAsAdmin(() => prisma.tenant.delete({ where: { id: tenantId } }));
    await adminPool.end();
  });

  beforeEach(() => {
    sentEmails.length = 0;
    sentTelegram.length = 0;
    queue.clearMemoryJobs();
    captcha.setCaptchaVerifier(null);
  });

  it('el catálogo público solo muestra lo reservable en línea', async () => {
    const res = await request(app).get(`/api/public/booking/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.services.map((s: any) => s.name)).toEqual(['Corte']);
    expect(res.body.professionals[0].name).toBe('Carlos');
    expect(res.body.labels.appointment).toBe('turno');
    expect(res.body).not.toHaveProperty('telegramBotToken');
  });

  it('un salón inexistente responde 404 sin revelar nada más', async () => {
    expect((await request(app).get('/api/public/booking/no-existe')).status).toBe(404);
  });

  it('ofrece huecos y marca los días con disponibilidad', async () => {
    const from = mondayAfter(3, 5);
    const slots = await request(app).get(`/api/public/booking/${slug}/availability`).query({ serviceId, date: from });
    expect(slots.status).toBe(200);
    expect(slots.body.slots.length).toBeGreaterThan(0);

    const to = mondayAfter(3, 6);
    const calendar = await request(app).get(`/api/public/booking/${slug}/calendar`).query({ serviceId, from, to });
    expect(calendar.status).toBe(200);
    // Solo los lunes tienen horario: exactamente esos dos días.
    expect(calendar.body.availableDates).toEqual([from, to]);
  });

  it('un servicio no reservable en línea se rechaza', async () => {
    const res = await request(app).get(`/api/public/booking/${slug}/availability`).query({ serviceId: privateServiceId, date: nextMonday() });
    expect(res.status).toBe(400);
  });

  it('reserva sin cuenta: crea al cliente, asigna profesional y encola confirmación y recordatorios', async () => {
    const date = nextMonday();
    const res = await book(validBody(date, '10:00'));
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SCHEDULED');
    expect(res.body.professionalName).toBe('Carlos');
    expect(res.body.manageUrl).toMatch(new RegExp(`^/${slug}/mi-cita/.{20,}`));
    expect(res.body.startTime).toBe('10:00');

    const client = await ctx.runAsAdmin(() => prisma.client.findFirst({ where: { tenantId, email: 'marta@example.com' } }));
    expect(client?.phoneKey).toBe('5355551234');

    const jobs = queue.getMemoryJobs();
    expect(jobs.map((j) => j.name).sort()).toEqual(['booking.confirmed', 'booking.reminder', 'booking.reminder']);
    const startsAt = new Date(res.body.startsAt).getTime();
    const reminderTimes = jobs.filter((j) => j.name === 'booking.reminder').map((j) => j.options.startAfter!.getTime()).sort((a, b) => a - b);
    expect(reminderTimes).toEqual([startsAt - 24 * 3600_000, startsAt - 2 * 3600_000]);
  });

  it('envía confirmación al cliente y avisa al dueño por correo y Telegram, sin duplicar', async () => {
    const res = await book(validBody(nextMonday(), '11:00', { customer: { name: 'Luis Gómez', email: 'luis@example.com' } }));
    expect(res.status).toBe(201);
    const confirmed = queue.getMemoryJobs().find((j) => j.name === 'booking.confirmed')!;
    const { tenantId: t, appointmentId } = confirmed.data as { tenantId: string; appointmentId: string };

    expect(await notifier.processConfirmed(t, appointmentId)).toBe('done');
    const toCustomer = sentEmails.find((m) => m.to === 'luis@example.com')!;
    expect(toCustomer.subject).toMatch(/turno/); // vocabulario del salón
    expect(toCustomer.text).toContain(`/${slug}/mi-cita/${tokenOf(res.body.manageUrl)}`);
    expect(sentEmails.some((m) => m.to === 'dueno@pub.com')).toBe(true);
    expect(sentTelegram).toHaveLength(1);
    expect(sentTelegram[0].chatId).toBe('999');
    expect(sentTelegram[0].text).toContain('Luis Gómez');

    const before = sentEmails.length + sentTelegram.length;
    await notifier.processConfirmed(t, appointmentId); // reintento del mismo trabajo
    expect(sentEmails.length + sentTelegram.length).toBe(before);
  });

  it('el correo al cliente lleva el logo y el color del salón, y el logo se sirve como imagen pública', async () => {
    const { config } = await import('../config');
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const setBrand = (data: { logoUrl: string | null; brandColor: string | null }) =>
      ctx.runAsAdmin(() => prisma.tenantSettings.update({ where: { tenantId }, data }));

    // sin logo configurado: 404
    expect((await request(app).get(`/api/public/booking/${slug}/logo`)).status).toBe(404);

    await setBrand({ logoUrl: `data:image/png;base64,${png}`, brandColor: '#2A9D8F' });
    const image = await request(app).get(`/api/public/booking/${slug}/logo`);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/png');
    expect(image.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(Buffer.from(image.body).equals(Buffer.from(png, 'base64'))).toBe(true);

    const previous = config.apiPublicUrl;
    config.apiPublicUrl = 'https://api.test';
    try {
      const res = await book(validBody(nextMonday(), '15:00', { customer: { name: 'Rosa Paz', email: 'rosa@example.com' } }));
      const { tenantId: t, appointmentId } = queue.getMemoryJobs().find((j) => j.name === 'booking.confirmed')!.data as { tenantId: string; appointmentId: string };
      await notifier.processConfirmed(t, appointmentId);
      const html = sentEmails.find((m) => m.to === 'rosa@example.com')!.html!;
      expect(html).toContain(`src="https://api.test/api/public/booking/${slug}/logo"`);
      expect(html).toContain('#2A9D8F');
      expect(html).toContain(`/${slug}/mi-cita/${tokenOf(res.body.manageUrl)}`);

      // sin API pública no hay a dónde apuntar la imagen: el correo sale igual, sin logo
      config.apiPublicUrl = '';
      queue.clearMemoryJobs();
      sentEmails.length = 0;
      await book(validBody(nextMonday(), '16:00', { customer: { name: 'Ana Gil', email: 'ana@example.com' } }));
      const second = queue.getMemoryJobs().find((j) => j.name === 'booking.confirmed')!.data as { tenantId: string; appointmentId: string };
      await notifier.processConfirmed(second.tenantId, second.appointmentId);
      expect(sentEmails.find((m) => m.to === 'ana@example.com')!.html).not.toContain('<img');
    } finally {
      config.apiPublicUrl = previous;
      await setBrand({ logoUrl: null, brandColor: null });
    }
  });

  it('un recordatorio obsoleto (la cita se movió) no se envía', async () => {
    const res = await book(validBody(nextMonday(), '12:00', { customer: { name: 'Eva Ruiz', email: 'eva@example.com' } }));
    const reminder = queue.getMemoryJobs().find((j) => j.name === 'booking.reminder')!;
    const { tenantId: t, appointmentId, hoursBefore, startsAt } = reminder.data as any;
    expect(appointmentId).toBeTruthy();

    expect(await notifier.processReminder(t, appointmentId, hoursBefore, startsAt)).toBe('done');
    expect(sentEmails.filter((m) => m.to === 'eva@example.com')).toHaveLength(1);

    sentEmails.length = 0;
    await notifier.processReminder(t, appointmentId, 5, startsAt + 3600_000); // horario ya cambiado
    expect(sentEmails).toHaveLength(0);
    expect(res.status).toBe(201);
  });

  it('el mismo hueco no se reserva dos veces', async () => {
    const date = nextMonday();
    expect((await book(validBody(date, '14:00', { customer: { name: 'Ana', email: 'ana1@example.com' } }))).status).toBe(201);
    const second = await book(validBody(date, '14:00', { customer: { name: 'Ana B', email: 'ana2@example.com' } }));
    expect(second.status).toBe(409);
  });

  it('exige teléfono o correo, ignora la trampa para bots y verifica el captcha', async () => {
    const date = nextMonday();
    const noContact = await book(validBody(date, '15:00', { customer: { name: 'Sin Contacto' } }));
    expect(noContact.status).toBe(400);

    const bot = await book(validBody(date, '15:00', { website: 'http://spam' }));
    expect(bot.status).toBe(400);

    captcha.setCaptchaVerifier(async () => false);
    const failed = await book(validBody(date, '15:00', { captchaToken: 'x' }));
    expect(failed.status).toBe(400);
    expect(failed.body.error).toMatch(/persona/);
  });

  it('limita las reservas activas por cliente y lo reconoce por teléfono aunque cambie el formato', async () => {
    const customer = (phone: string) => ({ customer: { name: 'Pablo Díaz', phone } });
    const d = (n: number) => mondayAfter(3, 5 + n);
    expect((await book(validBody(d(0), '09:00', customer('+53 5 777 8888')))).status).toBe(201);
    expect((await book(validBody(d(1), '09:00', customer('53-5777-8888')))).status).toBe(201);
    const third = await book(validBody(d(2), '09:00', customer('(53) 5 777 8888')));
    expect(third.status).toBe(429);

    const clients = await ctx.runAsAdmin(() => prisma.client.count({ where: { tenantId, phoneKey: '5357778888' } }));
    expect(clients).toBe(1);
  });

  describe('enlace para gestionar la cita', () => {
    it('muestra, reprograma y cancela sin cuenta; cancelar libera el hueco y avisa al dueño', async () => {
      const date = nextMonday();
      const created = await book(validBody(date, '16:00', { customer: { name: 'Rosa Mena', email: 'rosa@example.com' } }));
      const token = tokenOf(created.body.manageUrl);
      const base = `/api/public/booking/${slug}/manage/${token}`;

      const view = await request(app).get(base);
      expect(view.status).toBe(200);
      expect(view.body.appointment.serviceName).toBe('Corte');
      expect(view.body.canCancel).toBe(true);

      // Reprogramar a otra hora del mismo día
      queue.clearMemoryJobs();
      const moved = await request(app).post(`${base}/reschedule`).send({ date, startTime: '16:30' });
      expect(moved.status).toBe(200);
      expect(moved.body.appointment.startTime).toBe('16:30');
      expect(queue.getMemoryJobs().some((j) => j.name === 'booking.reminder')).toBe(true);

      // El hueco original quedó libre para otra persona
      const taken = await book(validBody(date, '16:00', { customer: { name: 'Otra', email: 'otra@example.com' } }));
      expect(taken.status).toBe(201);

      // Cancelar
      queue.clearMemoryJobs();
      const cancelled = await request(app).post(`${base}/cancel`).send({});
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.appointment.status).toBe('CANCELLED');
      const stored = await ctx.runAsAdmin(() => prisma.appointment.findUniqueOrThrow({ where: { id: view.body.appointment.id } }));
      expect(stored.cancelledBy).toBe('CUSTOMER');

      const job = queue.getMemoryJobs().find((j) => j.name === 'booking.cancelled')!;
      sentEmails.length = 0;
      sentTelegram.length = 0;
      await notifier.processCancelled(tenantId, (job.data as any).appointmentId, 'CUSTOMER');
      expect(sentEmails.some((m) => m.to === 'rosa@example.com')).toBe(false); // ella misma canceló
      expect(sentEmails.some((m) => m.to === 'dueno@pub.com')).toBe(true);
      expect(sentTelegram).toHaveLength(1);

      // Una segunda cancelación ya no procede
      expect((await request(app).post(`${base}/cancel`).send({})).status).toBe(409);
    });

    it('un token falso o de otro salón responde 404', async () => {
      const fake = 'x'.repeat(43);
      expect((await request(app).get(`/api/public/booking/${slug}/manage/${fake}`)).status).toBe(404);
      expect((await request(app).get(`/api/public/booking/no-existe/manage/${fake}`)).status).toBe(404);
    });

    it('dentro de la ventana de cancelación ya no se puede cancelar ni mover', async () => {
      const clientId = await ctx.runAsAdmin(async () => (await prisma.client.findFirstOrThrow({ where: { tenantId } })).id);
      const soon = new Date(Date.now() + 3 * 3600_000);
      const appt = await ctx.runAsAdmin(() =>
        prisma.appointment.create({
          data: {
            tenantId, clientId, serviceId, professionalId: proId, serviceName: 'Corte', priceAmount: 15, durationMin: 30,
            startsAt: soon, endsAt: new Date(soon.getTime() + 1800_000), blockStartsAt: soon, blockEndsAt: new Date(soon.getTime() + 1800_000),
            cancelToken: 'soon-token-'.padEnd(43, 's'),
          },
        })
      );
      const base = `/api/public/booking/${slug}/manage/${appt.cancelToken}`;
      expect((await request(app).get(base)).body.canCancel).toBe(false);
      expect((await request(app).post(`${base}/cancel`).send({})).status).toBe(409);
      expect((await request(app).post(`${base}/reschedule`).send({ date: mondayAfter(3), startTime: '09:00' })).status).toBe(409);
    });

    it('el enlace caduca una semana después de que termina la cita', async () => {
      const clientId = await ctx.runAsAdmin(async () => (await prisma.client.findFirstOrThrow({ where: { tenantId } })).id);
      const past = new Date(Date.now() - 10 * 24 * 3600_000);
      const appt = await ctx.runAsAdmin(() =>
        prisma.appointment.create({
          data: {
            tenantId, clientId, serviceId, professionalId: proId, serviceName: 'Corte', priceAmount: 15, durationMin: 30, status: 'COMPLETED',
            startsAt: past, endsAt: new Date(past.getTime() + 1800_000), blockStartsAt: past, blockEndsAt: new Date(past.getTime() + 1800_000),
            cancelToken: 'old-token-'.padEnd(43, 'o'),
          },
        })
      );
      expect((await request(app).get(`/api/public/booking/${slug}/manage/${appt.cancelToken}`)).status).toBe(404);
    });
  });

  it('con las reservas en línea desactivadas no se puede reservar, pero sí gestionar una cita', async () => {
    const created = await book(validBody(nextMonday(), '17:00', { customer: { name: 'Nora', email: 'nora@example.com' } }));
    expect(created.status).toBe(201);
    await ctx.runAsAdmin(() => prisma.tenantSettings.update({ where: { tenantId }, data: { bookingEnabled: false } }));
    try {
      expect((await book(validBody(nextMonday(), '09:30'))).status).toBe(403);
      expect((await request(app).get(`/api/public/booking/${slug}/availability`).query({ serviceId, date: nextMonday() })).status).toBe(403);
      expect((await request(app).get(`/api/public/booking/${slug}/manage/${tokenOf(created.body.manageUrl)}`)).status).toBe(200);
    } finally {
      await ctx.runAsAdmin(() => prisma.tenantSettings.update({ where: { tenantId }, data: { bookingEnabled: true } }));
    }
  });

  it('un fallo permanente de correo se registra sin reintentar; uno transitorio pide reintento', async () => {
    const res = await book(validBody(nextMonday(), '09:30', { customer: { name: 'Tina', email: 'tina@example.com' } }));
    const job = queue.getMemoryJobs().find((j) => j.name === 'booking.confirmed')!;
    const id = (job.data as any).appointmentId;

    emailChannel.setEmailSender(async () => ({ ok: false, reason: 'buzón inexistente', retryable: false }));
    expect(await notifier.processConfirmed(tenantId, id)).toBe('done');
    const failed = await ctx.runAsAdmin(() => prisma.notification.findFirst({ where: { tenantId, recipient: 'tina@example.com' } }));
    expect(failed?.status).toBe('FAILED');
    expect(failed?.errorLog).toBe('buzón inexistente');

    emailChannel.setEmailSender(async () => ({ ok: false, reason: 'timeout', retryable: true }));
    expect(await notifier.processConfirmed(tenantId, id)).toBe('retry');

    emailChannel.setEmailSender(async (m) => {
      sentEmails.push(m);
      return { ok: true };
    });
    expect(await notifier.processConfirmed(tenantId, id)).toBe('done');
    const sent = await ctx.runAsAdmin(() => prisma.notification.findFirst({ where: { tenantId, recipient: 'tina@example.com' } }));
    expect(sent?.status).toBe('SENT');
    expect(res.status).toBe(201);
  });
});
