import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

/** Búsqueda de citas por cliente o servicio (la usa el buscador del panel). */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

describeIfDb('búsqueda de citas', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let app: import('express').Express;
  let tenantId: string;
  let otherTenantId: string;
  let owner: string;
  let staff: string;

  const get = (token: string, q?: string) =>
    request(app).get('/api/appointments').query({ from: '2031-02-01', to: '2031-02-28', ...(q ? { q } : {}) }).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    app = (await import('../app')).default;
    const slug = `buscar-${Date.now().toString(36)}`;
    const hash = await bcrypt.hash('secret123', 4);
    await ctx.runAsAdmin(async () => {
      tenantId = (await prisma.tenant.create({ data: { name: 'Salón búsqueda', slug } })).id;
      otherTenantId = (await prisma.tenant.create({ data: { name: 'Otro', slug: `${slug}-o` } })).id;
      await prisma.tenantSettings.create({ data: { tenantId } });
      const ownerUser = await prisma.user.create({ data: { email: 'owner@b.com', password: hash, name: 'Dueña', role: 'OWNER', tenantId } });
      const staffUser = await prisma.user.create({ data: { email: 'staff@b.com', password: hash, name: 'Ana', role: 'STAFF', tenantId } });
      const category = await prisma.category.create({ data: { name: 'Servicios', tenantId } });
      const mkService = (name: string) => prisma.service.create({ data: { name, price: 10, categoryId: category.id, userId: ownerUser.id, tenantId } });
      const [relleno, corte] = [await mkService('Relleno de acrílico'), await mkService('Corte')];
      const proAna = await prisma.professional.create({ data: { name: 'Ana', tenantId, userId: staffUser.id } });
      const proLuis = await prisma.professional.create({ data: { name: 'Luis', tenantId } });
      const mkClient = (name: string, phone: string, email?: string) => prisma.client.create({ data: { name, phone, phoneKey: phone.replace(/\D/g, ''), email, userId: ownerUser.id, tenantId } });
      const maria = await mkClient('María Fernández', '+53 5 555 1001', 'maria@ejemplo.com');
      const yadira = await mkClient('Yadira Castillo', '+53 5 555 2002');
      const mk = (day: number, clientId: string, serviceId: string, serviceName: string, professionalId: string) => {
        const startsAt = new Date(Date.UTC(2031, 1, day, 14));
        const endsAt = new Date(startsAt.getTime() + 3600000);
        return prisma.appointment.create({ data: { tenantId, clientId, serviceId, professionalId, status: 'SCHEDULED', startsAt, endsAt, blockStartsAt: startsAt, blockEndsAt: endsAt, serviceName, priceAmount: 10, durationMin: 60, source: 'ADMIN' } });
      };
      await mk(3, maria.id, relleno.id, 'Relleno de acrílico', proAna.id);
      await mk(4, yadira.id, corte.id, 'Corte', proLuis.id);
      await mk(5, yadira.id, relleno.id, 'Relleno de acrílico', proAna.id);
    });
    const login = async (email: string) => (await request(app).post('/api/auth/login').send({ tenantSlug: slug, email, password: 'secret123' })).body.token as string;
    owner = await login('owner@b.com');
    staff = await login('staff@b.com');
  });

  afterAll(async () => {
    await ctx.runAsAdmin(async () => {
      await prisma.tenant.delete({ where: { id: tenantId } });
      await prisma.tenant.delete({ where: { id: otherTenantId } });
    });
    await adminPool.end();
  });

  it('sin búsqueda devuelve todas las del rango', async () => {
    expect((await get(owner)).body).toHaveLength(3);
  });

  it('busca por nombre del cliente sin importar mayúsculas ni parte del nombre', async () => {
    const res = await get(owner, 'yadi');
    expect(res.body.map((a: any) => a.client.name)).toEqual(['Yadira Castillo', 'Yadira Castillo']);
  });

  it('busca por teléfono y por correo', async () => {
    expect((await get(owner, '555 1001')).body).toHaveLength(1);
    expect((await get(owner, 'MARIA@ejemplo')).body).toHaveLength(1);
  });

  it('busca por nombre del servicio', async () => {
    const res = await get(owner, 'acrílico');
    expect(res.body).toHaveLength(2);
  });

  it('una búsqueda sin resultados devuelve una lista vacía', async () => {
    expect((await get(owner, 'zzz')).body).toEqual([]);
  });

  it('un profesional solo encuentra entre sus propias citas', async () => {
    const res = await get(staff, 'yadi');
    expect(res.body).toHaveLength(1); // la de Luis no es suya
    expect(res.body[0].serviceName).toBe('Relleno de acrílico');
  });

  it('rechaza una búsqueda demasiado larga', async () => {
    expect((await get(owner, 'x'.repeat(81))).status).toBe(400);
  });
});
