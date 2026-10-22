import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

/**
 * Pruebas de aislamiento entre salones contra Postgres real.
 *
 * Las políticas RLS no se aplican a superusuarios, así que la app de este test
 * se conecta con el rol `vortex_app` (NOSUPERUSER) que crea la migración
 * row_level_security; la preparación de datos usa la conexión de admin.
 *
 *   RUN_DB_TESTS=1 DATABASE_URL=postgresql://user:pass@localhost:5432/vortex_test npm test
 */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

describeIfDb('aislamiento multi-tenant', () => {
  let adminPool: Pool;
  let app: import('express').Express;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');

  const ids: Record<string, any> = {};

  async function login(tenantSlug: string, email: string, password = 'secret123') {
    const res = await request(app).post('/api/auth/login').send({ tenantSlug, email, password });
    return res;
  }

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    app = (await import('../app')).default;

    const suffix = Date.now().toString(36);
    const hash = await bcrypt.hash('secret123', 4);

    await ctx.runAsAdmin(async () => {
      for (const key of ['a', 'b']) {
        const tenant = await prisma.tenant.create({ data: { name: `Salón ${key}`, slug: `iso-${key}-${suffix}` } });
        // Mismo email en ambos salones: debe estar permitido.
        const admin = await prisma.user.create({
          data: { email: 'admin@mismo.com', password: hash, name: `Admin ${key}`, role: 'OWNER', tenantId: tenant.id },
        });
        const client = await prisma.client.create({
          data: { name: `Cliente ${key}`, email: `cliente-${key}@x.com`, userId: admin.id, tenantId: tenant.id },
        });
        const category = await prisma.category.create({ data: { name: 'Servicios', tenantId: tenant.id } });
        const product = await prisma.service.create({
          data: { name: `Servicio ${key}`, price: 10, categoryId: category.id, userId: admin.id, tenantId: tenant.id },
        });
        const professional = await prisma.professional.create({ data: { name: `Pro ${key}`, tenantId: tenant.id } });
        const appointment = await prisma.appointment.create({
          data: {
            startsAt: new Date('2030-01-07T10:00:00.000Z'),
            endsAt: new Date('2030-01-07T11:00:00.000Z'),
            blockStartsAt: new Date('2030-01-07T10:00:00.000Z'),
            blockEndsAt: new Date('2030-01-07T11:00:00.000Z'),
            serviceName: product.name,
            priceAmount: 10,
            durationMin: 60,
            clientId: client.id,
            serviceId: product.id,
            professionalId: professional.id,
            tenantId: tenant.id,
          },
        });
        ids[key] = { tenant, admin, client, product, professional, appointment, slug: tenant.slug };
      }
    });
  });

  afterAll(async () => {
    await ctx.runAsAdmin(async () => {
      for (const key of ['a', 'b']) {
        if (ids[key]) await prisma.tenant.delete({ where: { id: ids[key].tenant.id } });
      }
    });
    await adminPool.end();
  });

  describe('RLS en la base de datos', () => {
    it('toda tabla con tenantId de negocio tiene RLS activa y forzada', async () => {
      // Tablas de plataforma: tienen tenantId pero las gestiona el portal de plataforma.
      // RefreshToken y CalendarFeed se consultan por un token secreto (solo su hash) antes de conocer el salón.
      const platformTables = ['AuditLog', 'PlatformInvoice', 'TenantSubscription', 'RefreshToken', 'CalendarFeed'];
      const { rows } = await adminPool.query(
        `SELECT c.table_name, cl.relrowsecurity, cl.relforcerowsecurity
           FROM information_schema.columns c
           JOIN pg_class cl ON cl.relname = c.table_name AND cl.relnamespace = 'public'::regnamespace
          WHERE c.table_schema = 'public' AND c.column_name = 'tenantId'`
      );
      const unprotected = rows
        .filter((r) => !platformTables.includes(r.table_name))
        .filter((r) => !r.relrowsecurity || !r.relforcerowsecurity)
        .map((r) => r.table_name);
      expect(unprotected).toEqual([]);
    });

    it('sin contexto de tenant no se ve ninguna fila', async () => {
      expect(await prisma.appointment.findMany()).toEqual([]);
      expect(await prisma.client.findMany()).toEqual([]);
    });

    it('con contexto solo se ven las filas del propio salón', async () => {
      const seenByA = await ctx.runWithTenant(ids.a.tenant.id, () => prisma.appointment.findMany());
      expect(seenByA.map((a) => a.id)).toEqual([ids.a.appointment.id]);
    });

    it('un findMany sin where no filtra datos de otro salón', async () => {
      const clients = await ctx.runWithTenant(ids.b.tenant.id, () => prisma.client.findMany());
      expect(clients.every((c) => c.tenantId === ids.b.tenant.id)).toBe(true);
    });

    it('no se puede escribir una fila de otro salón (WITH CHECK)', async () => {
      await expect(
        ctx.runWithTenant(ids.a.tenant.id, () =>
          prisma.category.create({ data: { name: 'Intruso', tenantId: ids.b.tenant.id } })
        )
      ).rejects.toThrow();
    });

    it('no se puede modificar ni borrar una fila de otro salón', async () => {
      const updated = await ctx.runWithTenant(ids.a.tenant.id, () =>
        prisma.appointment.updateMany({ where: { id: ids.b.appointment.id }, data: { notes: 'hack' } })
      );
      expect(updated.count).toBe(0);
      const deleted = await ctx.runWithTenant(ids.a.tenant.id, () =>
        prisma.appointment.deleteMany({ where: { id: ids.b.appointment.id } })
      );
      expect(deleted.count).toBe(0);
    });

    it('el modo admin (plataforma) ve todos los salones', async () => {
      const all = await ctx.runAsAdmin(() => prisma.appointment.findMany({ where: { id: { in: [ids.a.appointment.id, ids.b.appointment.id] } } }));
      expect(all).toHaveLength(2);
    });
  });

  describe('API HTTP', () => {
    let tokenA: string;

    beforeAll(async () => {
      const res = await login(ids.a.slug, 'admin@mismo.com');
      expect(res.status).toBe(200);
      tokenA = res.body.token;
    });

    const authA = () => ({ Authorization: `Bearer ${tokenA}` });

    it('el listado de citas solo contiene las del salón del token', async () => {
      const res = await request(app).get('/api/appointments').query({ from: '2030-01-01', to: '2030-12-31' }).set(authA());
      expect(res.status).toBe(200);
      expect(res.body.map((a: any) => a.id)).toEqual([ids.a.appointment.id]);
    });

    it.each([
      ['GET', () => `/api/appointments/${ids.b.appointment.id}`],
      ['PUT', () => `/api/appointments/${ids.b.appointment.id}`],
      ['DELETE', () => `/api/appointments/${ids.b.appointment.id}`],
      ['GET', () => `/api/clients/${ids.b.client.id}`],
      ['PUT', () => `/api/clients/${ids.b.client.id}`],
      ['DELETE', () => `/api/clients/${ids.b.client.id}`],
      ['GET', () => `/api/services/${ids.b.product.id}`],
      ['PUT', () => `/api/services/${ids.b.product.id}`],
      ['DELETE', () => `/api/services/${ids.b.product.id}`],
    ])('%s sobre un recurso de otro salón responde 404', async (method, url) => {
      const res = await (request(app) as any)[method.toLowerCase()](url()).set(authA()).send({ notes: 'x', name: 'x' });
      expect([404, 400]).toContain(res.status);
      expect(res.status).not.toBe(200);
    });

    it('el recurso del otro salón sigue intacto', async () => {
      const still = await ctx.runAsAdmin(() => prisma.appointment.findUnique({ where: { id: ids.b.appointment.id } }));
      expect(still).not.toBeNull();
      expect(still!.notes).toBeNull();
    });

    it('no se puede crear una cita con cliente o servicio de otro salón', async () => {
      const res = await request(app)
        .post('/api/appointments')
        .set(authA())
        .send({ date: '2030-01-08T00:00:00.000Z', startTime: '10:00', clientId: ids.b.client.id, serviceId: ids.a.product.id });
      expect(res.status).toBe(400);
    });

    it('la ruta de tickets ya no existe', async () => {
      const res = await request(app).get('/api/tickets').set(authA());
      expect(res.status).toBe(404);
    });

    it('un token sin Authorization es rechazado', async () => {
      const res = await request(app).get('/api/appointments');
      expect(res.status).toBe(401);
    });
  });

  describe('autenticación por salón', () => {
    it('el mismo email puede existir en dos salones y cada login entra al suyo', async () => {
      const a = await login(ids.a.slug, 'admin@mismo.com');
      const b = await login(ids.b.slug, 'admin@mismo.com');
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      expect(a.body.user.id).toBe(ids.a.admin.id);
      expect(b.body.user.id).toBe(ids.b.admin.id);
    });

    it('login en un salón inexistente o con contraseña errónea da el mismo error', async () => {
      const wrongTenant = await login('no-existe', 'admin@mismo.com');
      const wrongPass = await login(ids.a.slug, 'admin@mismo.com', 'incorrecta');
      expect(wrongTenant.status).toBe(400);
      expect(wrongPass.status).toBe(400);
      expect(wrongTenant.body).toEqual(wrongPass.body);
    });

    it('un salón suspendido pierde el acceso (login y token vigente)', async () => {
      const before = await login(ids.b.slug, 'admin@mismo.com');
      expect(before.status).toBe(200);

      await ctx.runAsAdmin(() => prisma.tenant.update({ where: { id: ids.b.tenant.id }, data: { status: 'SUSPENDED' } }));
      const { invalidateTenantStatus } = await import('../middleware/auth');
      invalidateTenantStatus(ids.b.tenant.id);

      const afterLogin = await login(ids.b.slug, 'admin@mismo.com');
      expect(afterLogin.status).toBe(400);

      const withOldToken = await request(app).get('/api/appointments').set({ Authorization: `Bearer ${before.body.token}` });
      expect(withOldToken.status).toBe(403);

      await ctx.runAsAdmin(() => prisma.tenant.update({ where: { id: ids.b.tenant.id }, data: { status: 'ACTIVE' } }));
      invalidateTenantStatus(ids.b.tenant.id);
    });
  });
});
