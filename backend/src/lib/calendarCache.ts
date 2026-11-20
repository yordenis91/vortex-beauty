/**
 * Caché corta del calendario público («¿qué días tienen hueco?»).
 * Calcularlo cuesta unas 45 consultas por petición, y cada visita pide dos meses. Con 20 s de
 * vida las visitas seguidas comparten el cálculo, y las peticiones idénticas simultáneas
 * esperan al mismo resultado. Una reserva, cancelación o cambio hecho desde la página pública
 * vacía la caché de ese salón al instante; los cambios del panel se ven en un máximo de 20 s
 * (reservar sigue comprobando el hueco real, así que nunca se acepta un hueco ocupado).
 */
const MAX_ENTRIES = 500;
let ttlMs = process.env.VITEST ? 0 : 20_000;

type Entry = { expires: number; value: Promise<string[]> };
const entries = new Map<string, Entry>();

/** Solo para pruebas: 0 desactiva la caché. */
export function setCalendarCacheTtl(ms: number) {
  ttlMs = ms;
  entries.clear();
}

export function clearCalendarCache(tenantId: string) {
  for (const key of entries.keys()) if (key.startsWith(`${tenantId}|`)) entries.delete(key);
}

export function cachedCalendar(key: string, tenantId: string, compute: () => Promise<string[]>): Promise<string[]> {
  if (ttlMs <= 0) return compute();
  const fullKey = `${tenantId}|${key}`;
  const now = Date.now();
  const hit = entries.get(fullKey);
  if (hit && hit.expires > now) return hit.value;

  const value = compute();
  // Un error no se guarda: la siguiente petición lo reintenta.
  value.catch(() => {
    if (entries.get(fullKey)?.value === value) entries.delete(fullKey);
  });
  if (entries.size >= MAX_ENTRIES) {
    for (const [k, e] of entries) if (e.expires <= now) entries.delete(k);
    if (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value as string);
  }
  entries.set(fullKey, { expires: now + ttlMs, value });
  return value;
}
