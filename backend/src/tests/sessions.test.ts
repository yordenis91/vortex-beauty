import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

/**
 * Sesiones: access token corto + refresh token rotativo en cookie httpOnly.
 */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

describeIfDb('sesiones renovables', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let app: import('express').Express;
  let tenantId: string;
  let slug: string;
  let userId: string;

  const AJAX = { 'X-Requested-With': 'XMLHttpRequest' };
  const login = () => request(app).post('/api/auth/login').send({ tenantSlug: slug, email: 'u@t.com', password: 'secret123' });
  const cookieOf = (res: request.Response) => (res.headers['set-cookie'] as unknown as string[] | undefined)?.find((c) => c.startsWith('vb_refresh='));
  const pairOf = (cookie: string) => cookie.split(';')[0];

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    app = (await import('../app')).default;
    slug = `ses-${Date.now().toString(36)}`;
    await ctx.runAsAdmin(async () => {
      const tenant = await prisma.tenant.create({ data: { name: 'Salón sesiones', slug } });
      tenantId = tenant.id;
      const user = await prisma.user.create({
        data: { email: 'u@t.com', password: await bcrypt.hash('secret123', 4), name: 'U', role: 'ADMIN', tenantId },
      });
      userId = user.id;
    });
  });

  afterAll(async () => {
    await ctx.runAsAdmin(() => prisma.tenant.delete({ where: { id: tenantId } }));
    await adminPool.end();
  });

  it('el login devuelve un access token de 15 minutos y una cookie httpOnly', async () => {
    const res = await login();
    expect(res.status).toBe(200);
    const payload = jwt.decode(res.body.token) as { exp: number; iat: number };
    expect(payload.exp - payload.iat).toBe(15 * 60);

    const cookie = cookieOf(res)!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    expect(cookie).toMatch(/SameSite=Lax/i);
    // El refresh token no viaja en el cuerpo
    expect(JSON.stringify(res.body)).not.toContain(pairOf(cookie).split('=')[1]);
  });

  it('refresh rota el token: el anterior deja de servir y se detecta su reutilización', async () => {
    const first = cookieOf(await login())!;
    const refreshed = await request(app).post('/api/auth/refresh').set(AJAX).set('Cookie', pairOf(first));
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.user.email).toBe('u@t.com');
    const second = cookieOf(refreshed)!;
    expect(pairOf(second)).not.toBe(pairOf(first));

    // El token nuevo funciona
    expect((await request(app).post('/api/auth/refresh').set(AJAX).set('Cookie', pairOf(second))).status).toBe(200);

    // Reusar el primero (ya rotado) es sospechoso: se rechaza y se cierran todas las sesiones del usuario
    const reused = await request(app).post('/api/auth/refresh').set(AJAX).set('Cookie', pairOf(first));
    expect(reused.status).toBe(401);
    expect(reused.body.reason).toBe('reused');
    const afterTheft = await request(app).post('/api/auth/refresh').set(AJAX).set('Cookie', pairOf(second));
    expect(afterTheft.status).toBe(401);
  });

  it('exige la cabecera X-Requested-With (defensa CSRF) y la cookie', async () => {
    const cookie = cookieOf(await login())!;
    expect((await request(app).post('/api/auth/refresh').set('Cookie', pairOf(cookie))).status).toBe(400);
    const none = await request(app).post('/api/auth/refresh').set(AJAX);
    expect(none.status).toBe(401);
    expect(none.body.reason).toBe('missing');
  });

  it('logout revoca la sesión', async () => {
    const cookie = cookieOf(await login())!;
    expect((await request(app).post('/api/auth/logout').set(AJAX).set('Cookie', pairOf(cookie))).status).toBe(200);
    expect((await request(app).post('/api/auth/refresh').set(AJAX).set('Cookie', pairOf(cookie))).status).toBe(401);
  });

  it('un usuario desactivado ya no puede iniciar ni renovar la sesión', async () => {
    const cookie = cookieOf(await login())!;
    await ctx.runAsAdmin(() => prisma.user.update({ where: { id: userId }, data: { isActive: false } }));
    try {
      const refresh = await request(app).post('/api/auth/refresh').set(AJAX).set('Cookie', pairOf(cookie));
      expect(refresh.status).toBe(401);
      expect(refresh.body.reason).toBe('inactive');
      expect((await login()).status).toBe(400);
    } finally {
      await ctx.runAsAdmin(() => prisma.user.update({ where: { id: userId }, data: { isActive: true } }));
    }
  });

  it('un salón suspendido no puede renovar la sesión', async () => {
    const cookie = cookieOf(await login())!;
    await ctx.runAsAdmin(() => prisma.tenant.update({ where: { id: tenantId }, data: { status: 'SUSPENDED' } }));
    try {
      const refresh = await request(app).post('/api/auth/refresh').set(AJAX).set('Cookie', pairOf(cookie));
      expect(refresh.status).toBe(401);
    } finally {
      await ctx.runAsAdmin(() => prisma.tenant.update({ where: { id: tenantId }, data: { status: 'ACTIVE' } }));
    }
  });

  it('una sesión caducada no se renueva', async () => {
    const cookie = cookieOf(await login())!;
    await adminPool.query(`UPDATE "RefreshToken" SET "expiresAt" = now() - interval '1 minute' WHERE "userId" = $1`, [userId]);
    const res = await request(app).post('/api/auth/refresh').set(AJAX).set('Cookie', pairOf(cookie));
    expect(res.status).toBe(401);
    expect(res.body.reason).toBe('expired');
  });
});
