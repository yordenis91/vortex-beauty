import { Prisma } from '@prisma/client';
import { basePrisma, sessionSettings } from '../prismaClient';
import { getTenantStore } from './tenantContext';

/**
 * Transacción interactiva que respeta el contexto de tenant actual.
 *
 * Usar siempre esto en lugar de `prisma.$transaction(async tx => ...)`: el
 * cliente extendido no puede anidar transacciones, así que aquí se abre la
 * transacción sobre el cliente base y se fijan las variables de sesión de RLS
 * antes de ejecutar el callback.
 */
export async function runInTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { isolationLevel?: Prisma.TransactionIsolationLevel; timeout?: number }
): Promise<T> {
  const settings = sessionSettings(getTenantStore());
  return basePrisma.$transaction(async (tx) => {
    for (const [key, value] of settings) {
      await tx.$executeRaw`SELECT set_config(${key}, ${value}, true)`;
    }
    return fn(tx);
  }, options);
}
