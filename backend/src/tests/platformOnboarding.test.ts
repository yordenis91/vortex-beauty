import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

/** Alta asistida de salones desde el Super Admin: plantilla, personalización, slugs reservados, límites de plan y bot. */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

describeIfDb('alta asistida de salones', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let app: import('express').Express;
  let telegram: typeof import('../services/channels/telegram');

  let token: string;
  let planId: string;
  let tinyPlanId: string;
  const suffix = Date.now().toString(36);
  const createdSlugs: string[] = [];
  const apiCalls: string[] = [];
  const email = `sa-${suffix}@test.com`;

  const hours = (open = [1, 2, 3, 4, 5, 6]) =>
    [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, isOpen: open.includes(d), startTime: '10:00', endTime: '19:00' }));

  const create = (body: Record<string, unknown>) =>
    request(app)
      .post('/api/platform/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Barbería Nueva', planId, adminName: 'Dueño', adminEmail: 'dueno@nuevo.com', ...body });

  const slug = (name: string) => {
    const s = `${name}-${suffix}`;
    createdSlugs.push(s);
    return s;
  };

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    app = (await import('../app')).default;
    telegram = await import('../services/channels/telegram');
    telegram.setTelegramApi(async (_t, method) => {
      apiCalls.push(method);
      if (_t === 'token-malo-123') return { ok: false, description: 'Unauthorized' };
      return method === 'getMe' ? { ok: true, result: { username: 'nuevo_bot' } } : { ok: true, result: true };
    });

    await ctx.runAsAdmin(async () => {
      await prisma.platformAdmin.create({ data: { email, password: await bcrypt.hash('super-clave-1', 4), name: 'SA', role: 'SUPER_ADMIN' } });
      planId = (await prisma.plan.create({ data: { name: 'PlanTest', slug: `plan-${suffix}`, priceMonthly: 5, priceYearly: 50, maxStaff: 5 } })).id;
      tinyPlanId = (await prisma.plan.create({ data: { name: 'PlanMini', slug: `mini-${suffix}`, priceMonthly: 1, priceYearly: 10, maxStaff: 1 } })).id;
    });
    const login = await request(app).post('/api/platform/auth/login').set('X-Requested-With', 'XMLHttpRequest').send({ email, password: 'super-clave-1' });
    token = login.body.token;
    expect(token).toBeTruthy();
  });

  afterAll(async () => {
    telegram.setTelegramApi(null);
    await ctx.runAsAdmin(async () => {
      await prisma.tenant.deleteMany({ where: { slug: { in: createdSlugs } } });
      await prisma.plan.deleteMany({ where: { id: { in: [planId, tinyPlanId] } } });
      await prisma.platformAdmin.deleteMany({ where: { email } });
    });
    await adminPool.end();
  });

  it('las plantillas exponen servicios y horario de cada vertical', async () => {
    const res = await request(app).get('/api/platform/tenants/templates').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.templates.BARBER.services.map((s: any) => s.name)).toContain('Corte de cabello');
    expect(res.body.templates.NAILS.professional).toBe('Manicurista principal');
    expect(res.body.hours).toHaveLength(7);
  });

  it('comprueba si un identificador está libre y rechaza los reservados', async () => {
    const free = await request(app).get('/api/platform/tenants/slug-available').query({ slug: `Libre Ñandú ${suffix}` }).set('Authorization', `Bearer ${token}`);
    expect(free.body).toMatchObject({ available: true, slug: `libre-nandu-${suffix}` });
    for (const reserved of ['admin', 'r', 'superadmin']) {
      const res = await request(app).get('/api/platform/tenants/slug-available').query({ slug: reserved }).set('Authorization', `Bearer ${token}`);
      expect(res.body.available).toBe(false);
    }
    expect((await create({ slug: 'admin' })).status).toBe(400);
  });

  it('sin personalizar, crea la plantilla del vertical', async () => {
    const s = slug('plantilla');
    const res = await create({ slug: s, vertical: 'BARBER' });
    expect(res.status).toBe(201);
    expect(res.body.telegram).toBeNull();
    const t = await ctx.runAsAdmin(() =>
      prisma.tenant.findUniqueOrThrow({ where: { slug: s }, include: { services: true, professionals: true, resources: true } })
    );
    expect(t.services.map((x) => x.name).sort()).toEqual(['Arreglo de barba', 'Corte + barba', 'Corte de cabello']);
    expect(t.professionals.map((x) => x.name)).toEqual(['Barbero principal']);
    expect(t.resources).toHaveLength(2);
    expect(t.timezone).toBe('UTC');
  });

  it('con personalización, usa los servicios, profesionales, horario, zona y moneda indicados', async () => {
    const s = slug('custom');
    const res = await create({
      slug: s,
      vertical: 'BARBER',
      timezone: 'America/Havana',
      currency: 'cup',
      professionals: ['Yoel', 'Raúl'],
      services: [
        { name: 'Corte clásico', price: 500, durationMinutes: 30 },
        { name: 'Barba', price: 300, durationMinutes: 20, category: 'Barba' },
      ],
      hours: hours([1, 2, 3, 4, 5]),
    });
    expect(res.status).toBe(201);
    const t = await ctx.runAsAdmin(() =>
      prisma.tenant.findUniqueOrThrow({
        where: { slug: s },
        include: {
          services: { include: { category: true, professionals: true } },
          professionals: { include: { schedules: true } },
          businessHours: true,
        },
      })
    );
    expect(t.timezone).toBe('America/Havana');
    expect(t.currency).toBe('CUP');
    expect(t.services.map((x) => [x.name, Number(x.price), x.category.name]).sort()).toEqual([
      ['Barba', 300, 'Barba'],
      ['Corte clásico', 500, 'Cortes'],
    ]);
    expect(t.professionals.map((p) => p.name).sort()).toEqual(['Raúl', 'Yoel']);
    // todos atienden todos los servicios, con el horario indicado (lunes a viernes de 10 a 19)
    for (const svc of t.services) expect(svc.professionals).toHaveLength(2);
    for (const pro of t.professionals) {
      expect(pro.schedules.map((x) => x.dayOfWeek).sort()).toEqual([1, 2, 3, 4, 5]);
      expect(pro.schedules[0]).toMatchObject({ startTime: '10:00', endTime: '19:00' });
    }
    expect(t.businessHours.filter((h) => h.isOpen)).toHaveLength(5);
  });

  it('rechaza datos inválidos: horario sin días abiertos, cierre antes de apertura, zona inexistente', async () => {
    expect((await create({ slug: slug('h0'), hours: hours([]) })).status).toBe(400);
    const reversed = hours().map((h) => ({ ...h, startTime: '20:00', endTime: '09:00' }));
    expect((await create({ slug: slug('h1'), hours: reversed })).status).toBe(400);
    expect((await create({ slug: slug('h2'), timezone: 'Marte/Olimpo' })).status).toBe(400);
  });

  it('respeta el límite de profesionales del plan', async () => {
    const res = await create({ slug: slug('limite'), planId: tinyPlanId, professionals: ['A1', 'B2'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/hasta 1/);
    expect((await create({ slug: slug('limite-ok'), planId: tinyPlanId, professionals: ['A1'] })).status).toBe(201);
  });

  it('un slug repetido responde 409', async () => {
    const s = slug('repetido');
    expect((await create({ slug: s })).status).toBe(201);
    expect((await create({ slug: s })).status).toBe(409);
  });

  it('conecta el bot de Telegram al crear y devuelve usuario y código del dueño', async () => {
    const s = slug('conbot');
    const res = await create({ slug: s, vertical: 'NAILS', telegramBotToken: '123456:ABCDEF' });
    expect(res.status).toBe(201);
    expect(res.body.telegram).toMatchObject({ ok: true, botUsername: 'nuevo_bot' });
    expect(res.body.telegram.ownerCode).toMatch(/^[0-9A-F]{8}$/);
    expect(apiCalls).toContain('setWebhook');
  });

  it('si el bot falla, el salón se crea igual y se avisa del error', async () => {
    const s = slug('botmalo');
    const res = await create({ slug: s, telegramBotToken: 'token-malo-123' });
    expect(res.status).toBe(201);
    expect(res.body.telegram.ok).toBe(false);
    expect(res.body.telegram.error).toMatch(/token/i);
    expect(await ctx.runAsAdmin(() => prisma.tenant.findUnique({ where: { slug: s } }))).not.toBeNull();
  });
});
