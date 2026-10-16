import { Pool } from 'pg';

/**
 * Preparación común de las pruebas con base de datos real.
 *
 * Las políticas RLS no se aplican a superusuarios, así que la app de prueba se
 * conecta con el rol `vortex_app` (NOSUPERUSER) que crea la migración
 * row_level_security. Los datos de prueba se crean en modo admin (bypass).
 */
export const APP_ROLE = 'vortex_app';
const APP_PASSWORD = 'vortex_app_test';

export const dbTestsEnabled = process.env.RUN_DB_TESTS === '1';

export async function setupAppDb() {
  const adminUrl = process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL!;
  process.env.ADMIN_DATABASE_URL = adminUrl;
  process.env.JWT_SECRET = 'test-secret';

  const adminPool = new Pool({ connectionString: adminUrl });
  await adminPool.query(`ALTER ROLE ${APP_ROLE} WITH LOGIN PASSWORD '${APP_PASSWORD}'`);

  const appUrl = new URL(adminUrl);
  appUrl.username = APP_ROLE;
  appUrl.password = APP_PASSWORD;
  process.env.DATABASE_URL = appUrl.toString();

  const prisma = (await import('../prismaClient')).default;
  const ctx = await import('../lib/tenantContext');
  return { adminPool, prisma, ctx };
}
