/**
 * Lo último que vio la clienta en las páginas públicas, guardado en su dispositivo:
 * así la página abre al instante y sigue mostrando algo si la conexión falla.
 * Es opcional: sin almacenamiento (modo privado) todo funciona, solo que sin esta ayuda.
 */
const PREFIX = 'afilao:pub:v1:';
const MAX_AGE = 7 * 24 * 3600 * 1000;

export interface Saved<T> {
  value: T;
  savedAt: number;
}

export function readSaved<T>(key: string, now = Date.now()): Saved<T> | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Saved<T>;
    if (typeof parsed?.savedAt !== 'number' || now - parsed.savedAt > MAX_AGE) {
      localStorage.removeItem(PREFIX + key);
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

export function save<T>(key: string, value: T) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ value, savedAt: Date.now() } satisfies Saved<T>));
  } catch {
    /* sin espacio o sin almacenamiento: no pasa nada */
  }
}

export function forget(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* nada que borrar */
  }
}

/** Huella corta del enlace secreto: sirve de clave sin dejar el token escrito en el almacenamiento. */
export function fingerprint(secret: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < secret.length; i++) {
    h ^= secret.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
