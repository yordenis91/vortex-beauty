import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { dbTestsEnabled, setupAppDb } from './dbHarness';
import { ownerAlert, professionalAlert, rescheduledMessage, type MessageContext } from '../services/notifications/templates';

/**
 * Avisos de cambio de hora, registro de envíos (filtros, paginación), reintento de fallidos y limpieza.
 */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

const ctx0: MessageContext = {
  salonName: 'Salón Demo',
  timezone: 'America/Havana',
  appointmentWord: 'cita',
  customerName: 'Marta',
  serviceName: 'Corte',
  professionalName: 'Ana',
  startsAt: new Date('2031-03-03T15:00:00.000Z'),
  previousStartsAt: new Date('2031-03-03T14:00:00.000Z'),
  price: '15.00 USD',
  manageUrl: 'https://x.test/mi-cita/abc',
  cancelWindowHrs: 12,
};

describe('textos de cambio de hora', () => {
  it('el aviso a la clienta dice la hora anterior y no habla de «confirmación»', () => {
    const m = rescheduledMessage(ctx0);
    expect(m.subject).toBe('Cambio en tu cita en Salón Demo');
    expect(m.text).toContain('Cambió la hora de tu cita: antes era');
    expect(m.text).toContain('https://x.test/mi-cita/abc');
    expect(m.text).not.toMatch(/Confirmamos/);
  });

  it('si la hora no cambió (otro dato), lo dice sin inventar un «antes»', () => {
    const m = rescheduledMessage({ ...ctx0, previousStartsAt: ctx0.startsAt });
    expect(m.text).toContain('Actualizamos los datos de tu cita.');
    expect(m.text).not.toContain('antes era');
  });

  it('los avisos al dueño y al profesional son de cambio, con la hora anterior', () => {
    const owner = ownerAlert('rescheduled', ctx0, 'PUBLIC');
    expect(owner).toContain('Cita: cambio de horario · Salón Demo');
    expect(owner).toContain('Antes:');
    expect(owner).not.toContain('nueva reserva');
    expect(owner).not.toContain('Origen:');
    const pro = professionalAlert('rescheduled', ctx0);
    expect(pro).toContain('Cita cambiada · Salón Demo');
    expect(pro).toContain('Antes:');
    expect(ownerAlert('created', ctx0, 'PUBLIC')).toContain('nueva reserva');
  });
});

function mondayAfter(minDaysAhead: number, nth = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + minDaysAhead);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + 7 * nth);
  return d.toISOString().slice(0, 10);
}

describeIfDb('avisos de cambio y registro de envíos', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let app: import('express').Express;
  let queue: typeof import('../lib/queue');
  let notifier: typeof import('../services/notifications/notifier');
  let service: typeof import('../services/notificationService');
  let emailChannel: typeof import('../services/channels/email');
  let telegramChannel: typeof import('../services/channels/telegram');
  let tenantId: string;
  let otherTenantId: string;
  let slug: string;
  let serviceId: string;
  let proId: string;
  let clientId: string;
  let weeks = 0;
  const tokens: Record<string, string> = {};
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  let emailsOk = true;
  const sentEmails: Array<{ to: string; subject: string; text: string }> = [];
  const sentTelegram: Array<{ chatId: string; text: string }> = [];

  const panelCreate = (time: string, extra: object = {}, nth?: number) =>
    request(app).post('/api/appointments').set(as('owner')).send({ date: mondayAfter(3, nth ?? weeks++), startTime: time, clientId, serviceId, professionalId: proId, ...extra });
  const job = (name: string) => queue.getMemoryJobs().find((j) => j.name === name);
  const runRescheduled = async () => {
    const j = job('booking.rescheduled')!;
    const d = j.data as { tenantId: string; appointmentId: string; previousStartsAt: number; startsAt: number; by: 'CUSTOMER' | 'STAFF' };
    return notifier.processRescheduled(d.tenantId, d.appointmentId, d.previousStartsAt, d.startsAt, d.by);
  };

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    app = (await import('../app')).default;
    queue = await import('../lib/queue');
    notifier = await import('../services/notifications/notifier');
    service = await import('../services/notificationService');
    emailChannel = await import('../services/channels/email');
    telegramChannel = await import('../services/channels/telegram');
    emailChannel.setEmailSender(async (m) => {
      if (!emailsOk) return { ok: false, reason: 'buzón lleno', retryable: false };
      sentEmails.push(m);
      return { ok: true };
    });
    telegramChannel.setTelegramSender(async (_t, chatId, text) => {
      sentTelegram.push({ chatId, text });
      return { ok: true };
    });

    slug = `avi-${Date.now().toString(36)}`;
    const hash = await bcrypt.hash('secret123', 4);
    await ctx.runAsAdmin(async () => {
      tenantId = (await prisma.tenant.create({ data: { name: 'Salón Avisos', slug, timezone: 'America/Bogota' } })).id;
      otherTenantId = (await prisma.tenant.create({ data: { name: 'Otro', slug: `${slug}-otro`, timezone: 'America/Bogota' } })).id;
      await prisma.tenantSettings.create({ data: { tenantId, telegramBotToken: 'bot', telegramChatId: '999' } });
      await prisma.tenantSettings.create({ data: { tenantId: otherTenantId } });
      const owner = await prisma.user.create({ data: { email: 'duena@avi.com', password: hash, name: 'Dueña', role: 'OWNER', tenantId } });
      await prisma.user.create({ data: { email: 'staff@avi.com', password: hash, name: 'Staff', role: 'STAFF', tenantId } });
      await prisma.user.create({ data: { email: 'otro@avi.com', password: hash, name: 'Otro', role: 'OWNER', tenantId: otherTenantId } });
      const category = await prisma.category.create({ data: { name: 'Cortes', tenantId } });
      serviceId = (await prisma.service.create({ data: { name: 'Corte', price: 15, durationMinutes: 30, categoryId: category.id, userId: owner.id, tenantId } })).id;
      proId = (await prisma.professional.create({ data: { name: 'Ana', tenantId } })).id;
      await prisma.professionalService.create({ data: { tenantId, professionalId: proId, serviceId } });
      await prisma.businessHour.create({ data: { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', tenantId } });
      await prisma.professionalSchedule.create({ data: { tenantId, professionalId: proId, dayOfWeek: 1, startTime: '09:00', endTime: '18:00' } });
      clientId = (await prisma.client.create({ data: { name: 'Marta Pérez', phone: '+57 300 111 2222', phoneKey: '573001112222', email: 'marta@example.com', userId: owner.id, tenantId } })).id;
    });
    for (const [who, email, tenantSlug] of [['owner', 'duena@avi.com', slug], ['staff', 'staff@avi.com', slug], ['otro', 'otro@avi.com', `${slug}-otro`]] as const) {
      tokens[who] = (await request(app).post('/api/auth/login').send({ tenantSlug, email, password: 'secret123' })).body.token;
    }
  });

  afterAll(async () => {
    emailChannel.setEmailSender(null);
    telegramChannel.setTelegramSender(null);
    await ctx.runAsAdmin(async () => {
      await prisma.tenant.delete({ where: { id: tenantId } });
      await prisma.tenant.delete({ where: { id: otherTenantId } });
    });
    await adminPool.end();
  });

  beforeEach(() => {
    emailsOk = true;
    sentEmails.length = 0;
    sentTelegram.length = 0;
    queue.clearMemoryJobs();
  });

  describe('cambio de hora', () => {
    it('lo hace el salón: encola un aviso de cambio (no una confirmación) y la clienta y el dueño reciben el texto de cambio', async () => {
      const created = await panelCreate('10:00');
      queue.clearMemoryJobs();
      const moved = await request(app).put(`/api/appointments/${created.body.id}`).set(as('owner')).send({ startTime: '12:00' });
      expect(moved.status).toBe(200);
      expect(job('booking.confirmed')).toBeUndefined();
      expect(job('booking.rescheduled')).toBeTruthy();
      expect(job('booking.reminder')).toBeTruthy(); // los recordatorios se reprograman igual

      expect(await runRescheduled()).toBe('done');
      const toCustomer = sentEmails.find((m) => m.to === 'marta@example.com')!;
      expect(toCustomer.subject).toContain('Cambio en tu cita');
      expect(toCustomer.text).toContain('antes era');
      expect(sentTelegram.some((t) => t.text.includes('cambio de horario') && t.text.includes('Antes:'))).toBe(true);
      expect(sentTelegram.some((t) => t.text.includes('nueva reserva'))).toBe(false);
    });

    it('no se manda dos veces si el trabajo se reintenta', async () => {
      const created = await panelCreate('10:30');
      queue.clearMemoryJobs();
      await request(app).put(`/api/appointments/${created.body.id}`).set(as('owner')).send({ startTime: '13:00' });
      await runRescheduled();
      const emails = sentEmails.length;
      const telegrams = sentTelegram.length;
      expect(emails).toBeGreaterThan(0);
      await runRescheduled();
      expect(sentEmails.length).toBe(emails);
      expect(sentTelegram.length).toBe(telegrams);
    });

    it('lo hace la clienta: al dueño se le avisa, a ella no', async () => {
      const date = mondayAfter(3, weeks++);
      const booked = await request(app)
        .post(`/api/public/booking/${slug}/bookings`)
        .send({ serviceId, professionalId: proId, date, startTime: '09:00', customer: { name: 'Lucía Gil', email: 'lucia@example.com' } });
      expect(booked.status).toBe(201);
      queue.clearMemoryJobs();
      const token = booked.body.manageUrl.split('/').pop();
      const moved = await request(app).post(`/api/public/booking/${slug}/manage/${token}/reschedule`).send({ date, startTime: '09:30' });
      expect(moved.status).toBe(200);
      expect((job('booking.rescheduled')!.data as { by: string }).by).toBe('CUSTOMER');

      await runRescheduled();
      expect(sentEmails.some((m) => m.to === 'lucia@example.com')).toBe(false);
      expect(sentTelegram.some((t) => t.text.includes('cambio de horario'))).toBe(true);
    });

    it('una cita del papel movida por el salón no le escribe a la clienta, pero sí avisa al dueño', async () => {
      const created = await panelCreate('11:00', { source: 'PAPEL' });
      queue.clearMemoryJobs();
      await request(app).put(`/api/appointments/${created.body.id}`).set(as('owner')).send({ startTime: '14:00' });
      await runRescheduled();
      expect(sentEmails.some((m) => m.to === 'marta@example.com')).toBe(false);
      expect(sentTelegram.some((t) => t.text.includes('cambio de horario'))).toBe(true);
    });

    it('si después se vuelve a mover, el aviso anterior ya no sale', async () => {
      const created = await panelCreate('15:00');
      queue.clearMemoryJobs();
      await request(app).put(`/api/appointments/${created.body.id}`).set(as('owner')).send({ startTime: '15:30' });
      const first = job('booking.rescheduled')!.data as { tenantId: string; appointmentId: string; previousStartsAt: number; startsAt: number };
      await request(app).put(`/api/appointments/${created.body.id}`).set(as('owner')).send({ startTime: '16:00' });
      expect(await notifier.processRescheduled(first.tenantId, first.appointmentId, first.previousStartsAt, first.startsAt, 'STAFF')).toBe('done');
      expect(sentEmails).toHaveLength(0);
      expect(sentTelegram).toHaveLength(0);
    });

    it('reabrir una cita cancelada se confirma como nueva, no como cambio', async () => {
      const created = await panelCreate('16:30');
      await request(app).put(`/api/appointments/${created.body.id}`).set(as('owner')).send({ status: 'CANCELLED' });
      queue.clearMemoryJobs();
      const reopened = await request(app).put(`/api/appointments/${created.body.id}`).set(as('owner')).send({ status: 'SCHEDULED' });
      expect(reopened.status).toBe(200);
      expect(job('booking.confirmed')).toBeTruthy();
      expect(job('booking.rescheduled')).toBeUndefined();
    });

    it('completar la cita no avisa de ningún cambio', async () => {
      const created = await panelCreate('17:00');
      queue.clearMemoryJobs();
      await request(app).put(`/api/appointments/${created.body.id}`).set(as('owner')).send({ status: 'COMPLETED' });
      expect(job('booking.rescheduled')).toBeUndefined();
    });
  });

  describe('registro de envíos', () => {
    const seed = async () => {
      await ctx.runAsAdmin(async () => {
        await prisma.notification.deleteMany({ where: { tenantId } });
        const mk = (type: 'EMAIL' | 'TELEGRAM' | 'SYSTEM', status: 'SENT' | 'FAILED' | 'PENDING', withClient: boolean, minutesAgo: number, extra: object = {}) =>
          prisma.notification.create({
            data: { tenantId, type, status, recipient: withClient ? 'marta@example.com' : '999', content: `Aviso ${type} ${status}`, clientId: withClient ? clientId : null, createdAt: new Date(Date.now() - minutesAgo * 60_000), isRead: true, ...extra },
          });
        await mk('EMAIL', 'SENT', true, 1);
        await mk('EMAIL', 'FAILED', true, 2, { errorLog: 'buzón lleno' });
        await mk('TELEGRAM', 'SENT', false, 3);
        await mk('TELEGRAM', 'FAILED', false, 4);
        await mk('EMAIL', 'PENDING', true, 5);
        await mk('SYSTEM', 'PENDING', false, 6); // fila antigua del panel: no es un envío
      });
    };
    const log = (who: string, query: object = {}) => request(app).get('/api/notifications/log').query(query).set(as(who));

    it('exige sesión y permiso de administración', async () => {
      expect((await request(app).get('/api/notifications/log')).status).toBe(401);
      expect((await log('staff')).status).toBe(403);
    });

    it('lista los envíos reales (sin las filas SYSTEM), con totales por estado', async () => {
      await seed();
      const res = await log('owner');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(5);
      expect(res.body.items.map((n: any) => n.type)).not.toContain('SYSTEM');
      expect(res.body.counts).toEqual({ PENDING: 1, SENT: 2, FAILED: 2 });
      expect(res.body.items[0].createdAt >= res.body.items[1].createdAt).toBe(true);
      // Sin clave de aviso de origen no hay reintento posible, aunque haya fallado.
      expect(res.body.items.every((n: any) => n.retryable === false)).toBe(true);
    });

    it('filtra por estado, canal y público; los totales respetan canal y público pero no el estado', async () => {
      await seed();
      const failed = await log('owner', { status: 'FAILED' });
      expect(failed.body.total).toBe(2);
      expect(failed.body.counts).toEqual({ PENDING: 1, SENT: 2, FAILED: 2 });

      const tg = await log('owner', { channel: 'TELEGRAM' });
      expect(tg.body.total).toBe(2);
      expect(tg.body.counts).toEqual({ PENDING: 0, SENT: 1, FAILED: 1 });

      const team = await log('owner', { audience: 'TEAM' });
      expect(team.body.total).toBe(2);
      const clients = await log('owner', { audience: 'CLIENTS', status: 'FAILED' });
      expect(clients.body.total).toBe(1);
      expect(clients.body.items[0].errorLog).toBe('buzón lleno');
      expect(clients.body.items[0].client.name).toBe('Marta Pérez');
    });

    it('pagina', async () => {
      await seed();
      const first = await log('owner', { pageSize: 2, page: 1 });
      const third = await log('owner', { pageSize: 2, page: 3 });
      expect(first.body.items).toHaveLength(2);
      expect(first.body.total).toBe(5);
      expect(third.body.items).toHaveLength(1);
      expect(third.body.page).toBe(3);
    });

    it('rechaza parámetros inválidos y no mezcla salones', async () => {
      await seed();
      expect((await log('owner', { status: 'LOQUESEA' })).status).toBe(400);
      expect((await log('owner', { pageSize: 500 })).status).toBe(400);
      expect((await log('otro')).body.total).toBe(0);
    });
  });

  describe('reintento de envíos fallidos', () => {
    it('reenvía un correo fallido y lo deja como enviado; uno ya enviado no se repite', async () => {
      emailsOk = false;
      const created = await panelCreate('09:00');
      queue.clearMemoryJobs();
      await notifier.processConfirmed(tenantId, created.body.id);
      const failed = await ctx.runAsAdmin(() => prisma.notification.findFirstOrThrow({ where: { tenantId, status: 'FAILED', recipient: 'marta@example.com', dedupeKey: { startsWith: `confirmed:${created.body.id}` } } }));
      expect(sentEmails).toHaveLength(0);

      emailsOk = true;
      const retry = await request(app).post(`/api/notifications/${failed.id}/retry`).set(as('owner'));
      expect(retry.status).toBe(200);
      expect(retry.body.result).toBe('sent');
      expect(sentEmails.filter((m) => m.to === 'marta@example.com')).toHaveLength(1);
      const stored = await ctx.runAsAdmin(() => prisma.notification.findUniqueOrThrow({ where: { id: failed.id } }));
      expect(stored.status).toBe('SENT');

      // Ya no está fallido: no se reintenta ni se duplica.
      expect((await request(app).post(`/api/notifications/${failed.id}/retry`).set(as('owner'))).status).toBe(409);
      expect(sentEmails.filter((m) => m.to === 'marta@example.com')).toHaveLength(1);
    });

    it('si sigue fallando lo dice, y no se puede reintentar lo de otro salón ni sin permiso', async () => {
      emailsOk = false;
      const created = await panelCreate('09:30');
      queue.clearMemoryJobs();
      await notifier.processConfirmed(tenantId, created.body.id);
      const failed = await ctx.runAsAdmin(() => prisma.notification.findFirstOrThrow({ where: { tenantId, status: 'FAILED', dedupeKey: { startsWith: `confirmed:${created.body.id}` }, recipient: 'marta@example.com' } }));

      const again = await request(app).post(`/api/notifications/${failed.id}/retry`).set(as('owner'));
      expect(again.status).toBe(200);
      expect(again.body.result).toBe('still-failed');

      expect((await request(app).post(`/api/notifications/${failed.id}/retry`).set(as('otro'))).status).toBe(409);
      expect((await request(app).post(`/api/notifications/${failed.id}/retry`).set(as('staff'))).status).toBe(403);
      expect((await request(app).post(`/api/notifications/${failed.id}/retry`)).status).toBe(401);
    });

    it('el registro marca como reintentables solo los fallidos de avisos de citas', async () => {
      const [ok, daily] = await ctx.runAsAdmin(() =>
        Promise.all([
          prisma.notification.create({ data: { tenantId, type: 'EMAIL', status: 'FAILED', recipient: 'a@x.com', content: 'x', dedupeKey: 'reminder:abc:1:24', isRead: true } }),
          prisma.notification.create({ data: { tenantId, type: 'TELEGRAM', status: 'FAILED', recipient: '1', content: 'y', dedupeKey: 'daily:2031-01-01:z', isRead: true } }),
        ])
      );
      const res = await request(app).get('/api/notifications/log').query({ status: 'FAILED', pageSize: 100 }).set(as('owner'));
      const byId = new Map<string, any>(res.body.items.map((n: any) => [n.id, n]));
      expect(byId.get(ok.id).retryable).toBe(true);
      expect(byId.get(daily.id).retryable).toBe(false);
    });

    it('un envío sin aviso de origen (p. ej. el resumen diario) no se puede reintentar', async () => {
      const row = await ctx.runAsAdmin(() => prisma.notification.create({ data: { tenantId, type: 'TELEGRAM', status: 'FAILED', recipient: '999', content: 'Resumen', dedupeKey: 'daily:2031-01-01:x', isRead: true } }));
      expect((await request(app).post(`/api/notifications/${row.id}/retry`).set(as('owner'))).status).toBe(409);
    });
  });

  describe('limpieza', () => {
    it('borra los envíos de más de 90 días y conserva los recientes', async () => {
      const old = new Date(Date.now() - 91 * 24 * 3600 * 1000);
      const fresh = new Date(Date.now() - 89 * 24 * 3600 * 1000);
      const [a, b] = await ctx.runAsAdmin(() =>
        Promise.all([
          prisma.notification.create({ data: { tenantId, type: 'EMAIL', status: 'SENT', recipient: 'a@x.com', content: 'vieja', createdAt: old, isRead: true } }),
          prisma.notification.create({ data: { tenantId, type: 'EMAIL', status: 'SENT', recipient: 'b@x.com', content: 'reciente', createdAt: fresh, isRead: true } }),
        ])
      );
      expect(await service.pruneOldNotifications()).toBeGreaterThanOrEqual(1);
      expect(await ctx.runAsAdmin(() => prisma.notification.findUnique({ where: { id: a.id } }))).toBeNull();
      expect(await ctx.runAsAdmin(() => prisma.notification.findUnique({ where: { id: b.id } }))).not.toBeNull();
    });
  });
});
