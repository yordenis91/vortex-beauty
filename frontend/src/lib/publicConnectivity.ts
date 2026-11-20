/**
 * Qué significa un fallo en las páginas públicas (reservar, mi cita).
 * Solo un 404 quiere decir «ese negocio/enlace no existe»; una conexión lenta o caída,
 * o un fallo del servidor, no deben hacerle creer a la clienta que su enlace es inválido.
 */
export type ErrorKind = 'not-found' | 'connection' | 'server' | 'other';

type Failure = { response?: { status?: number } | undefined; code?: string };

export function errorKind(error: unknown): ErrorKind {
  const failure = error as Failure | null | undefined;
  if (!failure) return 'other';
  // Sin respuesta: se cayó la red, no hubo señal o se agotó el tiempo de espera.
  if (!failure.response) return 'connection';
  const status = failure.response.status ?? 0;
  if (status === 404) return 'not-found';
  // 408/429 y los 5xx (incluidos los del proxy) son pasajeros: reintentar suele funcionar.
  if (status === 408 || status === 429 || status >= 500) return 'server';
  return 'other';
}

/** Fallos que se arreglan solos o con un reintento (nunca los 4xx, que repetirlos no cambia nada). */
export const isTransient = (error: unknown) => {
  const kind = errorKind(error);
  return kind === 'connection' || kind === 'server';
};

// Esperas entre reintentos automáticos de las lecturas. Las pruebas las ponen a 0.
let delays = [1000, 3000, 6000];
export const setRetryDelays = (next: number[]) => {
  delays = next;
};

/** Para `useQuery`: reintenta hasta tres veces, y solo si el fallo es pasajero. */
export const retryTransient = (failureCount: number, error: unknown) => failureCount < delays.length && isTransient(error);
export const retryDelay = (attempt: number) => delays[attempt] ?? delays[delays.length - 1] ?? 0;

/** Opciones de reintento listas para esparcir en un `useQuery` público. */
export const publicRetry = { retry: retryTransient, retryDelay } as const;
