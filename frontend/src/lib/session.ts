import axios from 'axios';
import type { User } from '../types';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://deploy-vortex-backend.wgteoi.easypanel.host/api';

/**
 * Sesión del salón: el access token (15 min) vive solo en memoria. La sesión se
 * renueva con una cookie httpOnly que el navegador envía al endpoint de
 * renovación; JavaScript nunca ve el refresh token.
 */
let accessToken: string | null = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

// Impersonación (soporte): el token de 1 hora llega en el hash de la URL, se guarda
// solo en esta pestaña y no se renueva.
const IMPERSONATION_KEY = 'impersonation_token';

export function consumeImpersonationToken(): string | null {
  try {
    const match = window.location.hash.match(/impersonate=([^&]+)/);
    if (match) {
      sessionStorage.setItem(IMPERSONATION_KEY, decodeURIComponent(match[1]));
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return sessionStorage.getItem(IMPERSONATION_KEY);
  } catch {
    return null;
  }
}

export const isImpersonating = () => {
  try {
    return !!sessionStorage.getItem(IMPERSONATION_KEY);
  } catch {
    return false;
  }
};

export function clearImpersonation() {
  try {
    sessionStorage.removeItem(IMPERSONATION_KEY);
  } catch {
    // sin almacenamiento: nada que limpiar
  }
}

// Cliente sin interceptores: evita bucles al renovar o cerrar sesión.
const bare = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
});

// Copia mínima del usuario para poder abrir la app sin conexión (sin contraseñas ni tokens).
const USER_KEY = 'afilao-user';
export const saveUserSnapshot = (user: User) => {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // sin almacenamiento: no se podrá abrir sin conexión
  }
};
export const loadUserSnapshot = (): User | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
};
const clearUserSnapshot = () => {
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    // nada que limpiar
  }
};

export interface SessionResponse {
  user: User;
  token: string;
}

// Marca no secreta ("hubo un inicio de sesión en este navegador"): evita pedir una renovación
// a cada visitante anónimo de las páginas públicas. La sesión real es la cookie httpOnly.
const HINT_KEY = 'hasSession';
const setHint = (on: boolean) => {
  try {
    if (on) localStorage.setItem(HINT_KEY, '1');
    else {
      localStorage.removeItem(HINT_KEY);
      clearUserSnapshot();
    }
  } catch {
    // sin almacenamiento: se intentará renovar siempre
  }
};
const hasHint = () => {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return true;
  }
};

export const rememberSession = () => setHint(true);

/** La marca de sesión sigue puesta: la sesión no ha terminado, solo puede faltar la red. */
export const sessionMayBeAlive = () => hasHint();

let networkFailure = false;
/** El último intento de renovar la sesión falló por falta de red (no porque la sesión terminara). */
export const lastRefreshWasOffline = () => networkFailure;

let inflight: Promise<SessionResponse | null> | null = null;

/** Renueva la sesión con la cookie. Varias llamadas simultáneas comparten una sola petición. */
export function refreshSession(): Promise<SessionResponse | null> {
  if (!inflight && !hasHint()) return Promise.resolve(null);
  if (!inflight) {
    inflight = bare
      .post<SessionResponse>('/auth/refresh')
      .then((response) => {
        setAccessToken(response.data.token);
        setHint(true);
        saveUserSnapshot(response.data.user);
        networkFailure = false;
        return response.data;
      })
      .catch((error) => {
        setAccessToken(null);
        networkFailure = !error?.response;
        // 401 = la sesión terminó de verdad; un fallo de red no borra la marca.
        if (error?.response?.status === 401) setHint(false);
        return null;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export async function endSession(): Promise<void> {
  setAccessToken(null);
  setHint(false);
  clearImpersonation();
  try {
    await bare.post('/auth/logout');
  } catch {
    // si el servidor no responde, la cookie caduca sola
  }
}
