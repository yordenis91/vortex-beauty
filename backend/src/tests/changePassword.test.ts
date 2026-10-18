import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { dbTestsEnabled, setupAppDb } from './dbHarness';

/** Cambio de la propia contraseña: valida la actual, exige una nueva decente y cierra las demás sesiones. */
const describeIfDb = dbTestsEnabled ? describe : describe.skip;

describeIfDb('cambio de contraseña', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let app: import('express').Express;
  let tenantId: string;
  let slug: string;
  let userId: string;

  const AJAX = { 'X-Requested-With': 'XMLHttpRequest' };
  const login = (password: string) => request(app).post('/api/auth/login').send({ tenantSlug: slug, email: 'dueno@cp.com', password });
  const cookieOf = (res: request.Response) => (res.headers['set-cookie'] as unknown as string[] | undefined)?.find((c) => c.startsWith('vb_refresh='));
  const pairOf = (cookie: string) => cookie.split(';')[0];
  const change = (token: string, body: object) => request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${token}`).send(body);

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    app = (await import('../app')).default;
    slug = `cp-${Date.now().toString(36)}`;
    await ctx.runAsAdmin(async () => {
      const tenant = await prisma.tenant.create({ data: { name: 'Salón CP', slug } });
      tenantId = tenant.id;
      userId = (await prisma.user.create({ data: { email: 'dueno@cp.com', password: await bcrypt.hash('Temporal123', 4), name: 'Dueño', role: 'OWNER', tenantId } })).id;
    });
  });

  afterAll(async () => {
    await ctx.runAsAdmin(() => prisma.tenant.delete({ where: { id: tenantId } }));
    await adminPool.end();
  });

  beforeEach(async () => {
    // cada prueba parte de la contraseña temporal
    await ctx.runAsAdmin(async () => prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash('Temporal123', 4) } }));
  });

  it('exige estar autenticado', async () => {
    const res = await request(app).post('/api/auth/change-password').send({ currentPassword: 'Temporal123', newPassword: 'NuevaClave456' });
    expect(res.status).toBe(401);
  });

  it('rechaza una contraseña actual incorrecta y no cambia nada', async () => {
    const { body } = await login('Temporal123');
    const res = await change(body.token, { currentPassword: 'equivocada', newPassword: 'NuevaClave456' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/actual no es correcta/);
    expect((await login('Temporal123')).status).toBe(200);
    expect((await login('NuevaClave456')).status).toBe(400);
  });

  it('rechaza una nueva contraseña corta o igual a la actual', async () => {
    const { body } = await login('Temporal123');
    expect((await change(body.token, { currentPassword: 'Temporal123', newPassword: 'corta' })).status).toBe(400);
    const same = await change(body.token, { currentPassword: 'Temporal123', newPassword: 'Temporal123' });
    expect(same.status).toBe(400);
    expect(same.body.error).toMatch(/distinta/);
  });

  it('cambia la contraseña: la nueva entra, la vieja no, y las otras sesiones se cierran', async () => {
    const first = await login('Temporal123');
    const otherDevice = cookieOf(await login('Temporal123'))!;

    const res = await change(first.body.token, { currentPassword: 'Temporal123', newPassword: 'NuevaClave456' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();

    expect((await login('NuevaClave456')).status).toBe(200);
    expect((await login('Temporal123')).status).toBe(400);

    // el otro dispositivo pierde la sesión
    expect((await request(app).post('/api/auth/refresh').set(AJAX).set('Cookie', pairOf(otherDevice))).status).toBe(401);

    // este dispositivo conserva una sesión válida con el token nuevo y su cookie nueva
    const newCookie = cookieOf(res)!;
    expect(newCookie).toBeTruthy();
    expect((await request(app).post('/api/auth/refresh').set(AJAX).set('Cookie', pairOf(newCookie))).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`)).status).toBe(200);
  });

  it('el límite de intentos cuenta solo los fallos: muchos accesos correctos no bloquean, los fallidos sí', async () => {
    for (let i = 0; i < 12; i++) expect((await login('Temporal123')).status).toBe(200); // ya superan el tope antiguo de 10
    let blockedAt = 0;
    for (let i = 1; i <= 30 && !blockedAt; i++) {
      if ((await login('equivocada')).status === 429) blockedAt = i;
    }
    expect(blockedAt).toBeGreaterThan(5); // los fallos de pruebas anteriores ya contaron
    expect(blockedAt).toBeLessThanOrEqual(20);
  });
});
