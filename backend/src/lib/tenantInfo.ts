import { basePrisma } from '../prismaClient';

// La zona horaria de un salón casi nunca cambia: se guarda en memoria un minuto.
const TTL_MS = 60_000;
const cache = new Map<string, { timezone: string; expires: number }>();

export async function getTenantTimezone(tenantId: string): Promise<string> {
  const hit = cache.get(tenantId);
  if (hit && hit.expires > Date.now()) return hit.timezone;
  const tenant = await basePrisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
  const timezone = tenant?.timezone ?? 'UTC';
  cache.set(tenantId, { timezone, expires: Date.now() + TTL_MS });
  return timezone;
}

export function invalidateTenantTimezone(tenantId: string) {
  cache.delete(tenantId);
}
