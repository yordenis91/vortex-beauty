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

/**
 * Los archivos de prueba corren en paralelo y todos preparan el mismo rol: un
 * ALTER ROLE simultáneo falla con "tuple concurrently updated". Se serializa
 * con un candado de aviso y solo se altera si hace falta.
 */
async function enableAppRoleLogin(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(7342001)');
    const { rows } = await client.query('SELECT rolcanlogin FROM pg_roles WHERE rolname = $1', [APP_ROLE]);
    if (!rows[0]?.rolcanlogin) {
      await client.query(`ALTER ROLE ${APP_ROLE} WITH LOGIN PASSWORD '${APP_PASSWORD}'`);
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(7342001)').catch(() => undefined);
    client.release();
  }
}

export async function setupAppDb() {
  const adminUrl = process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL!;
  process.env.ADMIN_DATABASE_URL = adminUrl;
  process.env.JWT_SECRET = 'test-secret';

  const adminPool = new Pool({ connectionString: adminUrl });
  await enableAppRoleLogin(adminPool);

  const appUrl = new URL(adminUrl);
  appUrl.username = APP_ROLE;
  appUrl.password = APP_PASSWORD;
  process.env.DATABASE_URL = appUrl.toString();

  const prisma = (await import('../prismaClient')).default;
  const ctx = await import('../lib/tenantContext');
  return { adminPool, prisma, ctx };
}
