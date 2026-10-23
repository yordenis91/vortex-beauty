import axios, { type InternalAxiosRequestConfig } from 'axios';
import { OfflineError, isOffline } from './offline';
import { API_BASE_URL, getAccessToken, isImpersonating, lastRefreshWasOffline, refreshSession } from './session';

export const api = axios.create({
  baseURL: API_BASE_URL,
  // La cookie de sesión (refresh token) viaja solo a /auth/*
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

api.interceptors.request.use((config) => {
  // Sin conexión solo se lee (de la caché); escribir fallaría a medias, así que se avisa de entrada.
  if (isOffline() && !['get', 'head'].includes((config.method ?? 'get').toLowerCase())) return Promise.reject(new OfflineError());
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

// Si el access token caducó (401), se renueva la sesión una vez y se repite la petición.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as RetriableConfig | undefined;
    const isAuthCall = original?.url?.startsWith('/auth/');

    if (error.response?.status === 401 && original && !original._retried && !isAuthCall && !isImpersonating()) {
      original._retried = true;
      const session = await refreshSession();
      if (session) {
        original.headers.Authorization = `Bearer ${session.token}`;
        return api(original);
      }
    }

    // Si la renovación falló por falta de red, la sesión sigue viva: no se expulsa al usuario.
    if (error.response?.status === 401 && !isAuthCall && !lastRefreshWasOffline()) {
      // La sesión no se pudo renovar: la ruta protegida redirige al login
      window.dispatchEvent(new Event('auth-error'));
    }
    return Promise.reject(error);
  }
);

export default api;
