import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

/** Telegram para clientes: enlace por /start, avisos por Telegram, /parar, bloqueo y código del dueño. */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

function mondayAfter(minDaysAhead: number, nth = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + minDaysAhead);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + 7 * nth);
  return d.toISOString().slice(0, 10);
}

describeIfDb('Telegram para clientes', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let app: import('express').Express;
  let notifier: typeof import('../services/notifications/notifier');
  let telegram: typeof import('../services/channels/telegram');
  let email: typeof import('../services/channels/email');
  let queue: typeof import('../lib/queue');

  let tenantId: string;
  let slug: string;
  let serviceId: string;
  let ownerToken: string;
  const sent: Array<{ chatId: string; text: string }> = [];
  const emails: Array<{ to: string; subject: string }> = [];
  const apiCalls: Array<{ method: string; body: any }> = [];
  let blockChat: string | null = null;
  let week = 0;
  const fakeApi = async (_t: string, method: string, body: any) => {
    apiCalls.push({ method, body });
    if (method === 'getMe') return { ok: true, result: { username: 'barberia_test_bot' } };
    return { ok: true, result: true };
  };
  const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

  const book = async (customer: object = { name: 'Marta', phone: '+53 5 555 1234', email: 'marta@example.com' }) => {
    const n = week++; // un hueco distinto por reserva (un solo profesional)
    const res = await request(app)
      .post(`/api/public/booking/${slug}/bookings`)
      .send({ serviceId, professionalId: 'any', date: mondayAfter(3, n % 6), startTime: `${String(9 + Math.floor(n / 6)).padStart(2, '0')}:00`, customer });
    expect(res.status).toBe(201);
    return res.body as { id: string; manageUrl: string; telegram: { botUsername: string; linked: boolean; deepLink: string } | null };
  };
  const tokenOf = (url: string) => url.split('/').pop()!;
  const secret = async () => (await ctx.runAsAdmin(() => prisma.tenantSettings.findUnique({ where: { tenantId } })))!.telegramWebhookSecret!;
  const hook = async (text: string, chatId = 777, headerSecret?: string) =>
    request(app)
      .post(`/api/telegram/webhook/${tenantId}`)
      .set(SECRET_HEADER, headerSecret ?? (await secret()))
      .send({ message: { text, chat: { id: chatId, type: 'private' } } });
  const clientChat = (id: string) =>
    ctx.runAsAdmin(async () => (await prisma.appointment.findUnique({ where: { id }, include: { client: true } }))!.client.telegramChatId);
  const settle = () => new Promise((r) => setTimeout(r, 150)); // el webhook responde antes de procesar

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    app = (await import('../app')).default;
    notifier = await import('../services/notifications/notifier');
    telegram = await import('../services/channels/telegram');
    email = await import('../services/channels/email');
    queue = await import('../lib/queue');

    email.setEmailSender(async (m) => {
      emails.push(m);
      return { ok: true };
    });
    telegram.setTelegramSender(async (_t, chatId, text) => {
      if (chatId === blockChat) return { ok: false, reason: 'Forbidden: bot was blocked by the user', retryable: false, blocked: true };
      sent.push({ chatId, text });
      return { ok: true };
    });
    telegram.setTelegramApi(fakeApi);

    slug = `tg-${Date.now().toString(36)}`;
    await ctx.runAsAdmin(async () => {
      const tenant = await prisma.tenant.create({ data: { name: 'Barbería TG', slug, timezone: 'America/Havana' } });
      tenantId = tenant.id;
      await prisma.tenantSettings.create({ data: { tenantId, cancelWindowHrs: 12, maxActivePerCustomer: 20 } });
      const owner = await prisma.user.create({
        data: { email: 'dueno@tg.com', password: await bcrypt.hash('clave-larga-1', 4), name: 'Dueño', role: 'OWNER', tenantId },
      });
      const category = await prisma.category.create({ data: { name: 'Cortes', tenantId } });
      const service = await prisma.service.create({ data: { name: 'Corte', price: 15, durationMinutes: 30, categoryId: category.id, userId: owner.id, tenantId } });
      serviceId = service.id;
      const staffUser = await prisma.user.create({
        data: { email: 'carlos@tg.com', password: await bcrypt.hash('clave-larga-1', 4), name: 'Carlos', role: 'STAFF', tenantId },
      });
      const pro = await prisma.professional.create({ data: { name: 'Carlos', tenantId, userId: staffUser.id } });
      await prisma.professionalService.create({ data: { tenantId, professionalId: pro.id, serviceId } });
      await prisma.businessHour.create({ data: { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', tenantId } });
      await prisma.professionalSchedule.create({ data: { tenantId, professionalId: pro.id, dayOfWeek: 1, startTime: '09:00', endTime: '18:00' } });
    });
    const login = await request(app).post('/api/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ tenantSlug: slug, email: 'dueno@tg.com', password: 'clave-larga-1' });
    ownerToken = login.body.token;
  });

  afterAll(async () => {
    email.setEmailSender(null);
    telegram.setTelegramSender(null);
    telegram.setTelegramApi(null);
    await ctx.runAsAdmin(() => prisma.tenant.delete({ where: { id: tenantId } }));
    await adminPool.end();
  });

  beforeEach(() => {
    sent.length = 0;
    emails.length = 0;
    apiCalls.length = 0;
    blockChat = null;
    queue.clearMemoryJobs();
  });

  it('sin bot, la reserva no ofrece Telegram', async () => {
    const booking = await book();
    expect(booking.telegram).toBeNull();
  });

  it('guardar el token valida el bot, registra el webhook con secreto y no devuelve secretos', async () => {
    const res = await request(app)
      .put('/api/settings/booking')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ telegramBotToken: '123:ABC' });
    expect(res.status).toBe(200);
    expect(res.body.telegramBotUsername).toBe('barberia_test_bot');
    expect(res.body.telegramOwnerCode).toMatch(/^[0-9A-F]{8}$/);
    expect(JSON.stringify(res.body)).not.toContain('123:ABC');
    const setHook = apiCalls.find((c) => c.method === 'setWebhook')!;
    expect(setHook.body.url).toContain(`/api/telegram/webhook/${tenantId}`);
    expect(setHook.body.secret_token).toHaveLength(48);
  });

  it('un token inválido se rechaza con 400', async () => {
    telegram.setTelegramApi(async () => ({ ok: false, description: 'Unauthorized' }));
    const res = await request(app).put('/api/settings/booking').set('Authorization', `Bearer ${ownerToken}`).send({ telegramBotToken: 'malo' });
    expect(res.status).toBe(400);
    telegram.setTelegramApi(fakeApi);
  });

  it('la reserva incluye el enlace t.me con el token secreto de la cita', async () => {
    const booking = await book();
    expect(booking.telegram).toMatchObject({ botUsername: 'barberia_test_bot', linked: false });
    expect(booking.telegram!.deepLink).toBe(`https://t.me/barberia_test_bot?start=${tokenOf(booking.manageUrl)}`);
    expect(tokenOf(booking.manageUrl).length).toBeLessThanOrEqual(64);
  });

  it('el webhook rechaza peticiones sin el secreto correcto', async () => {
    const booking = await book();
    const bad = await hook(`/start ${tokenOf(booking.manageUrl)}`, 777, 'secreto-falso');
    expect(bad.status).toBe(401);
    const none = await request(app).post(`/api/telegram/webhook/${tenantId}`).send({ message: { text: '/start x', chat: { id: 1, type: 'private' } } });
    expect(none.status).toBe(401);
    await settle();
    expect(await clientChat(booking.id)).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it('/start con el token enlaza al cliente y confirma por el bot', async () => {
    const booking = await book();
    expect((await hook(`/start ${tokenOf(booking.manageUrl)}`, 4242)).status).toBe(200);
    await settle();
    expect(await clientChat(booking.id)).toBe('4242');
    expect(sent[0].chatId).toBe('4242');
    expect(sent[0].text).toContain('Avisos activados');
    expect(sent[0].text).toContain('Corte');
    const manage = await request(app).get(`/api/public/booking/${slug}/manage/${tokenOf(booking.manageUrl)}`);
    expect(manage.body.telegram.linked).toBe(true);
  });

  it('un token inexistente no enlaza a nadie', async () => {
    await hook('/start ' + 'x'.repeat(43), 5555);
    await settle();
    expect(sent[0].text).toContain('ya no es válido');
  });

  it('con Telegram enlazado, los avisos van por Telegram y no por correo', async () => {
    const booking = await book();
    await hook(`/start ${tokenOf(booking.manageUrl)}`, 4343);
    await settle();
    sent.length = 0;
    emails.length = 0;
    expect(await notifier.processConfirmed(tenantId, booking.id)).toBe('done');
    expect(sent.some((m) => m.chatId === '4343' && m.text.includes('Confirmamos tu'))).toBe(true);
    expect(emails.some((m) => m.to === 'marta@example.com')).toBe(false);
  });

  it('un cliente solo con teléfono recibe avisos una vez enlaza Telegram', async () => {
    const booking = await book({ name: 'Sin Correo', phone: '+53 5 555 9999' });
    await notifier.processConfirmed(tenantId, booking.id);
    expect(emails.filter((m) => m.to !== 'dueno@tg.com')).toHaveLength(0);
    expect(sent.filter((m) => m.chatId === '999')).toHaveLength(0);
    await hook(`/start ${tokenOf(booking.manageUrl)}`, 4444);
    await settle();
    sent.length = 0;
    await notifier.processReminder(tenantId, booking.id, 24, (await ctx.runAsAdmin(() => prisma.appointment.findUnique({ where: { id: booking.id } })))!.startsAt.getTime());
    expect(sent.some((m) => m.chatId === '4444' && m.text.includes('Te recordamos'))).toBe(true);
  });

  it('si el cliente bloquea el bot, se desenlaza y se usa el correo', async () => {
    const booking = await book();
    await hook(`/start ${tokenOf(booking.manageUrl)}`, 4545);
    await settle();
    blockChat = '4545';
    sent.length = 0;
    emails.length = 0;
    await notifier.processConfirmed(tenantId, booking.id);
    expect(await clientChat(booking.id)).toBeNull();
    expect(emails.some((m) => m.to === 'marta@example.com')).toBe(true);
  });

  it('/parar desactiva los avisos y /citas lista las próximas', async () => {
    const booking = await book();
    await hook(`/start ${tokenOf(booking.manageUrl)}`, 4646);
    await settle();
    sent.length = 0;
    await hook('/citas', 4646);
    await settle();
    expect(sent[0].text).toContain('Corte');
    expect(sent[0].text).toContain(tokenOf(booking.manageUrl));
    await hook('/parar', 4646);
    await settle();
    expect(await clientChat(booking.id)).toBeNull();
  });

  it('/historial lista los trabajos completados de esa clienta y no las citas futuras', async () => {
    const empty = await book();
    await hook(`/start ${tokenOf(empty.manageUrl)}`, 4747);
    await settle();
    sent.length = 0;
    await hook('/historial', 4747);
    await settle();
    expect(sent[0].text).toContain('Aún no tienes trabajos');

    await adminPool.query(`UPDATE "Appointment" SET status = 'COMPLETED' WHERE id = $1`, [empty.id]);
    sent.length = 0;
    await hook('/historial', 4747);
    await settle();
    expect(sent[0].text).toContain('Tus últimos trabajos');
    expect(sent[0].text).toContain('Corte');
    // un chat sin vincular no ve nada
    sent.length = 0;
    await hook('/historial', 4848);
    await settle();
    expect(sent[0].text).toContain('Aún no tienes trabajos');
  });

  describe('avisos al profesional', () => {
    const asStaff = async () => {
      const login = await request(app).post('/api/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ tenantSlug: slug, email: 'carlos@tg.com', password: 'clave-larga-1' });
      return { Authorization: `Bearer ${login.body.token}` };
    };
    const link = async (headers: Record<string, string>) => (await request(app).get('/api/professionals/me/telegram').set(headers)).body as { hasProfessional: boolean; botUsername: string | null; linked: boolean; code: string | null };

    it('el profesional ve su código, lo enlaza con /vincular y el código no se puede reutilizar', async () => {
      const headers = await asStaff();
      const before = await link(headers);
      expect(before).toMatchObject({ hasProfessional: true, botUsername: 'barberia_test_bot', linked: false });
      expect(before.code).toMatch(/^[0-9A-F]{8}$/);
      expect((await link(headers)).code).toBe(before.code); // estable hasta que se use

      await hook(`/vincular ${before.code!.toLowerCase()}`, 6001);
      await settle();
      expect(sent[0].text).toContain('Carlos');
      expect(sent[0].text).toContain('avisos de tus citas');

      expect(await link(headers)).toMatchObject({ linked: true, code: null });
      sent.length = 0;
      await hook(`/vincular ${before.code}`, 6002);
      await settle();
      expect(sent[0].text).toContain('Código inválido');
    });

    it('recibe solo el aviso de sus citas nuevas y canceladas, sin precios ni origen', async () => {
      const booking = await book();
      sent.length = 0;
      await notifier.processConfirmed(tenantId, booking.id);
      const created = sent.find((m) => m.chatId === '6001')!;
      expect(created.text).toContain('Nueva cita para ti');
      expect(created.text).toContain('Marta');
      expect(created.text).not.toContain('Origen');

      await ctx.runAsAdmin(() => prisma.appointment.update({ where: { id: booking.id }, data: { status: 'CANCELLED', cancelledBy: 'CUSTOMER', cancelledAt: new Date() } }));
      sent.length = 0;
      await notifier.processCancelled(tenantId, booking.id, 'CUSTOMER');
      expect(sent.find((m) => m.chatId === '6001')!.text).toContain('cancelada');
      // reintentar el mismo trabajo no repite el aviso
      sent.length = 0;
      await notifier.processCancelled(tenantId, booking.id, 'CUSTOMER');
      expect(sent.filter((m) => m.chatId === '6001')).toHaveLength(0);
    });

    it('/citas del profesional lista sus próximas citas con el nombre del cliente', async () => {
      await book({ name: 'Rosa Pérez', phone: '+53 5 555 7777', email: 'rosa@example.com' });
      sent.length = 0;
      await hook('/citas', 6001);
      await settle();
      expect(sent[0].text).toContain('Tus próximas citas');
      expect(sent[0].text).toContain('Rosa Pérez');
      expect(sent[0].text).not.toContain('mi-cita'); // enlaces secretos solo para el cliente
    });

    it('el enlace de Telegram no se filtra por la lista de profesionales ni por las citas', async () => {
      const headers = await asStaff();
      const pros = await request(app).get('/api/professionals').set('Authorization', `Bearer ${ownerToken}`);
      expect(JSON.stringify(pros.body)).not.toMatch(/telegramChatId|telegramLinkCode|6001/);
      const day = mondayAfter(0, 0);
      const apts = await request(app).get('/api/appointments').query({ from: `${day}T00:00:00.000Z`, to: `${mondayAfter(0, 40)}T00:00:00.000Z` }).set(headers);
      expect(apts.status).toBe(200);
      expect(apts.body.length).toBeGreaterThan(0);
      expect(apts.body[0].professional).toBeTruthy();
      expect(JSON.stringify(apts.body)).not.toMatch(/telegramLinkCode|"telegramChatId":"6001"/);
    });

    it('/parar o desvincular desde Mi perfil corta los avisos', async () => {
      const headers = await asStaff();
      await hook('/parar', 6001);
      await settle();
      expect((await link(headers)).linked).toBe(false);

      // vuelve a enlazar y desvincula desde la API
      const { code } = await link(headers);
      await hook(`/vincular ${code}`, 6001);
      await settle();
      expect((await link(headers)).linked).toBe(true);
      expect((await request(app).delete('/api/professionals/me/telegram').set(headers)).status).toBe(200);
      expect((await link(headers)).linked).toBe(false);

      const booking = await book();
      sent.length = 0;
      await notifier.processConfirmed(tenantId, booking.id);
      expect(sent.filter((m) => m.chatId === '6001')).toHaveLength(0);
    });

    it('un usuario sin ficha de profesional (el dueño) no tiene enlace propio', async () => {
      const res = await request(app).get('/api/professionals/me/telegram').set('Authorization', `Bearer ${ownerToken}`);
      expect(res.body).toMatchObject({ hasProfessional: false, linked: false, code: null });
    });
  });

  it('el dueño enlaza su chat con /vincular <código>, que solo sirve una vez', async () => {
    const before = (await request(app).get('/api/settings/booking').set('Authorization', `Bearer ${ownerToken}`)).body.telegramOwnerCode;
    await hook('/vincular CODIGO00', 9001);
    await settle();
    expect(sent[0].text).toContain('Código inválido');
    await hook(`/vincular ${before}`, 9001);
    await settle();
    const after = (await request(app).get('/api/settings/booking').set('Authorization', `Bearer ${ownerToken}`)).body;
    expect(after.telegramChatId).toBe('9001');
    expect(after.telegramOwnerCode).not.toBe(before);

    // /citas del dueño: las próximas de todo el salón, con cliente y profesional.
    sent.length = 0;
    await hook('/citas', 9001);
    await settle();
    expect(sent[0].text).toContain('Próximas citas del salón');
    expect(sent[0].text).toContain('Rosa Pérez');
    expect(sent[0].text).toContain('Carlos');
    // Un chat desconocido no ve nada del salón.
    sent.length = 0;
    await hook('/citas', 9555);
    await settle();
    expect(sent[0].text).toBe('No tienes citas próximas.');

    sent.length = 0;
    await hook(`/vincular ${before}`, 9002);
    await settle();
    expect(sent[0].text).toContain('Código inválido');
  });

  it('desconectar el bot borra el webhook y desenlaza a los clientes', async () => {
    const booking = await book();
    await hook(`/start ${tokenOf(booking.manageUrl)}`, 4747);
    await settle();
    const res = await request(app).put('/api/settings/booking').set('Authorization', `Bearer ${ownerToken}`).send({ telegramBotToken: '' });
    expect(res.status).toBe(200);
    expect(res.body.telegramBotUsername).toBeNull();
    expect(apiCalls.some((c) => c.method === 'deleteWebhook')).toBe(true);
    expect(await clientChat(booking.id)).toBeNull();
    expect((await hook('/start x', 1, 'cualquiera')).status).toBe(401);
  });
});
