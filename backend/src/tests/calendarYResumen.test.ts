import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

/** Feed iCal de la agenda y resumen diario por Telegram. */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

describeIfDb('calendario suscrito y resumen diario', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let app: import('express').Express;
  let sendDailySummaries: typeof import('../services/notifications/dailySummary').sendDailySummaries;
  let setTelegramSender: typeof import('../services/channels/telegram').setTelegramSender;
  let tenantId: string;
  let otherTenantId: string;
  let owner: string;
  let staff: string;
  let proLuis: string;
  const sent: Array<{ chat: string; text: string }> = [];

  // 10 de febrero de 2031, 08:30 en La Habana (UTC-5): hora del resumen.
  const MORNING = new Date('2031-02-10T13:30:00Z');

  const tokenOf = (url: string) => url.split('/api/calendar/')[1].replace('.ics', '');
  // Las citas de prueba están en 2031: el calendario se consulta «como si fuera» esa fecha (solo Date; los tokens de sesión no se tocan).
  const feed = async (token: string) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2031-02-10T12:00:00Z'));
    try {
      return await request(app).get(`/api/calendar/${token}.ics`);
    } finally {
      vi.useRealTimers();
    }
  };
  const activate = async (jwt: string) => (await request(app).post('/api/calendar-feed').set('Authorization', `Bearer ${jwt}`)).body.url as string;

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    app = (await import('../app')).default;
    ({ sendDailySummaries } = await import('../services/notifications/dailySummary'));
    ({ setTelegramSender } = await import('../services/channels/telegram'));
    setTelegramSender(async (_token, chat, text) => {
      sent.push({ chat, text });
      return { ok: true };
    });

    const slug = `cal-${Date.now().toString(36)}`;
    const hash = await bcrypt.hash('secret123', 4);
    await ctx.runAsAdmin(async () => {
      const tenant = await prisma.tenant.create({ data: { name: 'Salón Calendario', slug, timezone: 'America/Havana' } });
      tenantId = tenant.id;
      const other = await prisma.tenant.create({ data: { name: 'Otro salón', slug: `${slug}-o`, timezone: 'America/Havana' } });
      otherTenantId = other.id;
      await prisma.tenantSettings.create({ data: { tenantId, telegramBotToken: 'tok', telegramChatId: '111' } });
      const ownerUser = await prisma.user.create({ data: { email: 'owner@c.com', password: hash, name: 'Dueña', role: 'OWNER', tenantId } });
      const staffUser = await prisma.user.create({ data: { email: 'staff@c.com', password: hash, name: 'Ana', role: 'STAFF', tenantId } });
      const category = await prisma.category.create({ data: { name: 'Servicios', tenantId } });
      const service = await prisma.service.create({ data: { name: 'Uñas acrílicas', price: 10, categoryId: category.id, userId: ownerUser.id, tenantId } });
      const ana = await prisma.professional.create({ data: { name: 'Ana', tenantId, userId: staffUser.id, telegramChatId: '222' } });
      const luis = await prisma.professional.create({ data: { name: 'Luis', tenantId } });
      proLuis = luis.id;
      const maria = await prisma.client.create({ data: { name: 'María Fernández', phone: '+53 5 555 1001', phoneKey: '5355551001', userId: ownerUser.id, tenantId } });

      const mk = (hourUtc: number, professionalId: string, status: 'SCHEDULED' | 'PENDING' | 'CANCELLED' = 'SCHEDULED', day = 10) => {
        const startsAt = new Date(Date.UTC(2031, 1, day, hourUtc));
        const endsAt = new Date(startsAt.getTime() + 3600000);
        return prisma.appointment.create({ data: { tenantId, clientId: maria.id, serviceId: service.id, professionalId, status, startsAt, endsAt, blockStartsAt: startsAt, blockEndsAt: endsAt, serviceName: 'Uñas acrílicas', priceAmount: 10, durationMin: 60, source: 'ADMIN' } });
      };
      await mk(14, ana.id); // 09:00 local, de Ana
      await mk(16, luis.id, 'PENDING'); // 11:00 local, de Luis
      await mk(18, luis.id, 'CANCELLED'); // cancelada: no cuenta en el resumen
      await mk(14, ana.id, 'SCHEDULED', 12); // otro día

      // Una cita de otro salón no debe aparecer jamás.
      const otherOwner = await prisma.user.create({ data: { email: 'o@o.com', password: hash, name: 'Otra', role: 'OWNER', tenantId: otherTenantId } });
      const otherCat = await prisma.category.create({ data: { name: 'S', tenantId: otherTenantId } });
      const otherSvc = await prisma.service.create({ data: { name: 'Secreto', price: 1, categoryId: otherCat.id, userId: otherOwner.id, tenantId: otherTenantId } });
      const otherPro = await prisma.professional.create({ data: { name: 'X', tenantId: otherTenantId } });
      const otherClient = await prisma.client.create({ data: { name: 'Cliente ajeno', phone: '+53 5 999', phoneKey: '53999', userId: otherOwner.id, tenantId: otherTenantId } });
      const s = new Date(Date.UTC(2031, 1, 10, 14));
      await prisma.appointment.create({ data: { tenantId: otherTenantId, clientId: otherClient.id, serviceId: otherSvc.id, professionalId: otherPro.id, status: 'SCHEDULED', startsAt: s, endsAt: new Date(s.getTime() + 3600000), blockStartsAt: s, blockEndsAt: new Date(s.getTime() + 3600000), serviceName: 'Secreto', priceAmount: 1, durationMin: 60, source: 'ADMIN' } });
    });
    const login = async (email: string) => (await request(app).post('/api/auth/login').send({ tenantSlug: slug, email, password: 'secret123' })).body.token as string;
    owner = await login('owner@c.com');
    staff = await login('staff@c.com');
  });

  afterAll(async () => {
    setTelegramSender(null);
    await ctx.runAsAdmin(async () => {
      await prisma.tenant.delete({ where: { id: tenantId } });
      await prisma.tenant.delete({ where: { id: otherTenantId } });
    });
    await adminPool.end();
  });

  beforeEach(() => {
    sent.length = 0;
  });

  describe('enlace de calendario', () => {
    it('sin enlace activo lo indica; sesión obligatoria', async () => {
      expect((await request(app).get('/api/calendar-feed')).status).toBe(401)
      const res = await request(app).get('/api/calendar-feed').set('Authorization', `Bearer ${owner}`);
      expect(res.body).toMatchObject({ active: false });
    });

    it('el dueño crea su enlace y el calendario recibe toda la agenda del salón, solo la suya', async () => {
      const url = await activate(owner);
      expect(url).toMatch(/\/api\/calendar\/[A-Za-z0-9_-]{40,}\.ics$/);
      const res = await feed(tokenOf(url));
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/calendar');
      expect(res.text).toContain('BEGIN:VCALENDAR');
      expect(res.text).toContain('X-WR-CALNAME:Citas · Salón Calendario');
      expect(res.text).toContain('SUMMARY:María Fernández · Uñas acrílicas');
      expect(res.text).toContain('DTSTART:20310210T140000Z');
      expect(res.text).toContain('Teléfono: +53 5 555 1001');
      expect(res.text.match(/BEGIN:VEVENT/g)!.length).toBe(4); // 3 del 10 (una cancelada) + 1 del 12
      expect(res.text).toContain('STATUS:CANCELLED');
      expect(res.text).not.toContain('Cliente ajeno');
      expect(res.text).not.toContain('Secreto');
      expect((await request(app).get('/api/calendar-feed').set('Authorization', `Bearer ${owner}`)).body.active).toBe(true);
    });

    it('un profesional solo recibe sus propias citas', async () => {
      const res = await feed(tokenOf(await activate(staff)));
      expect(res.status).toBe(200);
      expect(res.text.match(/BEGIN:VEVENT/g)!.length).toBe(2); // las dos de Ana
      expect(res.text).not.toContain('11:00');
    });

    it('en la base solo queda el hash: el token no se guarda', async () => {
      const token = tokenOf(await activate(owner));
      const rows = await adminPool.query('SELECT "tokenHash" FROM "CalendarFeed"');
      expect(rows.rows.some((r) => r.tokenHash === token)).toBe(false);
      expect(rows.rows.every((r) => /^[0-9a-f]{64}$/.test(r.tokenHash))).toBe(true);
    });

    it('regenerar invalida el enlace anterior', async () => {
      const first = tokenOf(await activate(owner));
      const second = tokenOf(await activate(owner));
      expect(second).not.toBe(first);
      expect((await feed(first)).status).toBe(404);
      expect((await feed(second)).status).toBe(200);
    });

    it('desactivar lo borra; un token inventado o corto da 404', async () => {
      const token = tokenOf(await activate(owner));
      expect((await request(app).delete('/api/calendar-feed').set('Authorization', `Bearer ${owner}`)).status).toBe(204);
      expect((await feed(token)).status).toBe(404);
      expect((await feed('x'.repeat(43))).status).toBe(404);
      expect((await feed('corto')).status).toBe(404);
    });

    it('una cuenta desactivada deja de recibir su calendario', async () => {
      const token = tokenOf(await activate(staff));
      await adminPool.query(`UPDATE "User" SET "isActive" = false WHERE email = 'staff@c.com'`);
      expect((await feed(token)).status).toBe(404);
      await adminPool.query(`UPDATE "User" SET "isActive" = true WHERE email = 'staff@c.com'`);
      expect((await feed(token)).status).toBe(200);
    });
  });

  describe('resumen diario', () => {
    const clearNotifications = () => adminPool.query(`DELETE FROM "Notification" WHERE "tenantId" = $1`, [tenantId]);

    it('a las 8:00 del salón: el dueño recibe todas las citas del día y cada profesional las suyas', async () => {
      await clearNotifications();
      await sendDailySummaries(MORNING);
      const toOwner = sent.find((m) => m.chat === '111')!;
      expect(toOwner.text).toContain('2 citas hoy, lunes 10 de febrero');
      expect(toOwner.text).toContain('• 09:00 · María Fernández · Uñas acrílicas (Ana)');
      expect(toOwner.text).toContain('• 11:00 · María Fernández · Uñas acrílicas (Luis) — pendiente de confirmar');
      expect(toOwner.text).not.toContain('13:00'); // la cancelada no cuenta
      const toAna = sent.find((m) => m.chat === '222')!;
      expect(toAna.text).toContain('1 cita hoy');
      expect(toAna.text).not.toContain('Luis');
      expect(sent).toHaveLength(2); // Luis no enlazó Telegram
    });

    it('no se repite si el trabajo se ejecuta otra vez en la misma mañana', async () => {
      await clearNotifications();
      await sendDailySummaries(MORNING);
      sent.length = 0;
      await sendDailySummaries(new Date('2031-02-10T13:45:00Z'));
      expect(sent).toHaveLength(0);
    });

    it('fuera de las 8:00 locales no envía nada', async () => {
      await clearNotifications();
      await sendDailySummaries(new Date('2031-02-10T15:30:00Z')); // 10:30 en La Habana
      await sendDailySummaries(new Date('2031-02-10T08:30:00Z')); // 03:30
      expect(sent).toHaveLength(0);
    });

    it('un día sin citas no manda nada', async () => {
      await clearNotifications();
      await sendDailySummaries(new Date('2031-02-11T13:30:00Z'));
      expect(sent).toHaveLength(0);
    });

    it('el salón puede desactivarlo', async () => {
      await clearNotifications();
      await adminPool.query(`UPDATE "TenantSettings" SET "dailySummary" = false WHERE "tenantId" = $1`, [tenantId]);
      await sendDailySummaries(MORNING);
      expect(sent).toHaveLength(0);
      await adminPool.query(`UPDATE "TenantSettings" SET "dailySummary" = true WHERE "tenantId" = $1`, [tenantId]);
    });

    it('si Telegram falla de forma transitoria pide reintentar', async () => {
      await clearNotifications();
      setTelegramSender(async () => ({ ok: false, reason: 'Telegram 502', retryable: true }));
      const result = await sendDailySummaries(MORNING);
      expect(result.retry).toBe(true);
      setTelegramSender(async (_t, chat, text) => { sent.push({ chat, text }); return { ok: true }; });
    });
  });
  void proLuis;
});
