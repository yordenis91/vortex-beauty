import { del, get, set } from 'idb-keyval';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query, QueryClient } from '@tanstack/react-query';

/**
 * Caché de datos para trabajar sin conexión: las consultas de la agenda se guardan en IndexedDB
 * y se restauran al abrir la app. Es solo lectura: las acciones que escriben necesitan internet.
 */

/** Consultas que se guardan en el dispositivo (la agenda y lo que necesita para mostrarse). */
const PERSISTED = new Set(['appointments', 'clients', 'services', 'professionals', 'categories', 'closed-dates', 'businessHours', 'booking-settings', 'time-off', 'schedule-overrides', 'schedule-override', 'fully-booked-dates']);

export const shouldPersist = (query: Pick<Query, 'queryKey' | 'state'>) =>
  query.state.status === 'success' && typeof query.queryKey[0] === 'string' && PERSISTED.has(query.queryKey[0]);

export const MAX_AGE = 1000 * 60 * 60 * 24 * 7; // una semana
const DB_KEY = 'afilao-cache';
const SYNC_KEY = 'afilao-last-sync';

// IndexedDB puede no existir o estar bloqueado (modo privado): sin él la app funciona, solo que sin caché.
const safe = async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await fn();
  } catch {
    return undefined;
  }
};

export const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => safe(() => get<string>(key)).then((v) => v ?? null),
    setItem: async (key, value) => void (await safe(() => set(key, value))),
    removeItem: async (key) => void (await safe(() => del(key))),
  },
  key: DB_KEY,
  throttleTime: 2000,
});

/** Versión de la caché: si cambia la forma de los datos, se descarta la guardada. */
export const CACHE_BUSTER = 'v1';

/** Momento (ms) de la última vez que llegaron datos del servidor; para el aviso «datos guardados a las…». */
export const lastSync = (): number | null => {
  try {
    const value = Number(localStorage.getItem(SYNC_KEY));
    return value > 0 ? value : null;
  } catch {
    return null;
  }
};

/** Anota cada respuesta correcta del servidor. */
export function trackLastSync(client: QueryClient) {
  return client.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'success' && event.query.state.fetchStatus !== 'paused') {
      try {
        localStorage.setItem(SYNC_KEY, String(Date.now()));
      } catch {
        // sin almacenamiento: el aviso sale sin hora
      }
    }
  });
}

/** Borra los datos guardados en el dispositivo (al cerrar sesión o cambiar de cuenta). */
export async function clearPersistedCache() {
  await safe(() => del(DB_KEY));
  try {
    localStorage.removeItem(SYNC_KEY);
  } catch {
    // nada que limpiar
  }
}
