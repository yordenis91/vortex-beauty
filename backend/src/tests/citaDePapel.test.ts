import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

/**
 * Citas anotadas primero en el cuaderno: se guardan con origen PAPEL y no le escriben a la clienta,
 * porque ya la acordó en persona. Las demás citas del panel siguen avisando como siempre.
 */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

function mondayAfter(minDaysAhead: number, nth = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + minDaysAhead);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + 7 * nth);
  return d.toISOString().slice(0, 10);
}

describeIfDb('citas del papel', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let app: import('express').Express;
  let queue: typeof import('../lib/queue');
  let notifier: typeof import('../services/notifications/notifier');
  let emailChannel: typeof import('../services/channels/email');
  let tenantId: string;
  let token: string;
  let clientId: string;
  let serviceId: string;
  let weeks = 0;
  const sentEmails: Array<{ to: string; subject: string }> = [];

  const create = (extra: object = {}, startTime = '10:00') =>
    request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: mondayAfter(3, weeks++), startTime, clientId, serviceId, ...extra });

  const clientNotices = () => ctx.runAsAdmin(() => prisma.notification.count({ where: { tenantId, clientId } }));

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    app = (await import('../app')).default;
    queue = await import('../lib/queue');
    notifier = await import('../services/notifications/notifier');
    emailChannel = await import('../services/channels/email');
    emailChannel.setEmailSender(async (m) => {
      sentEmails.push(m);
      return { ok: true };
    });

    const slug = `papel-${Date.now().toString(36)}`;
    await ctx.runAsAdmin(async () => {
      tenantId = (await prisma.tenant.create({ data: { name: 'Salón Papel', slug, timezone: 'America/Havana' } })).id;
      await prisma.tenantSettings.create({ data: { tenantId } });
      const owner = await prisma.user.create({ data: { email: 'duena@papel.com', password: await bcrypt.hash('secret123', 4), name: 'Dueña', role: 'OWNER', tenantId } });
      const category = await prisma.category.create({ data: { name: 'Uñas', tenantId } });
      serviceId = (await prisma.service.create({ data: { name: 'Manicura', price: 10, durationMinutes: 30, categoryId: category.id, userId: owner.id, tenantId } })).id;
      const pro = await prisma.professional.create({ data: { name: 'Yumi', tenantId } });
      await prisma.professionalService.create({ data: { tenantId, professionalId: pro.id, serviceId } });
      await prisma.businessHour.create({ data: { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', tenantId } });
      await prisma.professionalSchedule.create({ data: { tenantId, professionalId: pro.id, dayOfWeek: 1, startTime: '09:00', endTime: '18:00' } });
      clientId = (await prisma.client.create({ data: { name: 'Marta Pérez', phone: '+53 5 555 1234', phoneKey: '5355551234', email: 'marta@example.com', userId: owner.id, tenantId } })).id;
    });
    token = (await request(app).post('/api/auth/login').send({ tenantSlug: slug, email: 'duena@papel.com', password: 'secret123' })).body.token;
  });

  afterAll(async () => {
    emailChannel.setEmailSender(null);
    await ctx.runAsAdmin(() => prisma.tenant.delete({ where: { id: tenantId } }));
    await adminPool.end();
  });

  beforeEach(() => {
    sentEmails.length = 0;
    queue.clearMemoryJobs();
  });

  it('una cita normal del panel queda con origen ADMIN y avisa a la clienta', async () => {
    const before = await clientNotices();
    const res = await create();
    expect(res.status).toBe(201);
    expect(res.body.source).toBe('ADMIN');
    expect(await clientNotices()).toBe(before + 1);
  });

  it('con source PAPEL se guarda con ese origen y no le avisa a la clienta', async () => {
    const before = await clientNotices();
    const res = await create({ source: 'PAPEL' });
    expect(res.status).toBe(201);
    expect(res.body.source).toBe('PAPEL');
    expect(await clientNotices()).toBe(before);
  });

  it('la confirmación encolada no le escribe a la clienta, pero los recordatorios siguen', async () => {
    const res = await create({ source: 'PAPEL' });
    const jobs = queue.getMemoryJobs();
    expect(jobs.some((j) => j.name === 'booking.reminder')).toBe(true);
    expect(await notifier.processConfirmed(tenantId, res.body.id)).toBe('done');
    expect(sentEmails.some((m) => m.to === 'marta@example.com')).toBe(false);
  });

  it('una cita normal sí confirma por correo a la clienta', async () => {
    const res = await create();
    expect(await notifier.processConfirmed(tenantId, res.body.id)).toBe('done');
    expect(sentEmails.some((m) => m.to === 'marta@example.com')).toBe(true);
  });

  it('editar la cita no cambia su origen', async () => {
    const created = await create({ source: 'PAPEL' });
    const edited = await request(app).put(`/api/appointments/${created.body.id}`).set('Authorization', `Bearer ${token}`).send({ startTime: '11:00', source: 'ADMIN' });
    expect(edited.status).toBe(200);
    expect(edited.body.source).toBe('PAPEL');
  });

  it('rechaza un origen que no existe', async () => {
    expect((await create({ source: 'PUBLIC' })).status).toBe(400);
  });
});
