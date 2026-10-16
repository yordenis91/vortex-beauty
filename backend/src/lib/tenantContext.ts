import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto de aislamiento de la petición en curso.
 *
 * - `tenantId`: las consultas solo ven filas de ese salón (RLS en Postgres).
 * - `bypass`: acceso sin restricción de tenant. Solo para el portal de
 *   plataforma, seeds y tareas de sistema; nunca desde rutas de un salón.
 *
 * Si no hay contexto, la base de datos no devuelve ninguna fila de las tablas
 * protegidas: olvidar establecerlo falla "cerrado", no "abierto".
 */
export interface TenantStore {
  tenantId?: string;
  bypass?: boolean;
}

const storage = new AsyncLocalStorage<TenantStore>();

export function getTenantStore(): TenantStore | undefined {
  return storage.getStore();
}

// Las consultas de Prisma son "perezosas": solo se ejecutan cuando alguien hace
// `await`/`.then`. Si `fn` devuelve una sola consulta sin esperar, ese `.then`
// ocurriría fuera del contexto. Convertirla en Promise dentro del contexto
// fuerza que se ejecute con el tenant correcto.
function inContext<T>(store: TenantStore, fn: () => T): T {
  return storage.run(store, () => {
    const result: any = fn();
    return result && typeof result.then === 'function' ? (Promise.resolve(result) as any) : result;
  });
}

export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return inContext({ tenantId }, fn);
}

export function runAsAdmin<T>(fn: () => T): T {
  return inContext({ bypass: true }, fn);
}
