import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { getTenantStore, TenantStore } from './lib/tenantContext';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required for PrismaClient');
}

const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const adapter = new PrismaPg(pool);

/** Cliente sin extensiones. Solo para código de infraestructura (ver lib/db.ts). */
export const basePrisma = new PrismaClient({
  adapter,
  log: process.env.PRISMA_LOG_QUERIES === '1' ? ['error', 'warn', 'query'] : ['error', 'warn'],
});

/**
 * Variables de sesión de Postgres que leen las políticas RLS. Se fijan con
 * set_config(..., true), es decir, solo durante la transacción en curso, así
 * que nunca se filtran a otra petición que reutilice la conexión del pool.
 */
export function sessionSettings(store: TenantStore | undefined): Array<[string, string]> {
  if (store?.bypass) return [['app.bypass_rls', 'on']];
  if (store?.tenantId) return [['app.tenant_id', store.tenantId]];
  return [];
}

/**
 * Cada operación del cliente principal se ejecuta dentro de una transacción
 * interactiva que primero fija las variables de sesión del contexto actual
 * (tenant o bypass). Sin contexto, la consulta va tal cual y las políticas RLS
 * no devuelven filas de las tablas protegidas.
 *
 * Importante: no usar `prisma.$transaction(...)` del cliente extendido; cada
 * operación abriría su propia transacción y no compartirían atomicidad. Para
 * transacciones usar `runInTransaction` (lib/db.ts).
 */
const prisma = basePrisma.$extends({
  query: {
    async $allOperations({ model, operation, args, query }) {
      const settings = sessionSettings(getTenantStore());
      if (settings.length === 0) return query(args);

      return basePrisma.$transaction(async (tx) => {
        for (const [key, value] of settings) {
          await tx.$executeRaw`SELECT set_config(${key}, ${value}, true)`;
        }
        const target: any = model ? (tx as any)[model.charAt(0).toLowerCase() + model.slice(1)] : tx;
        return target[operation](args);
      });
    },
  },
});

export default prisma;
