import axios, { type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, getAccessToken, isImpersonating, refreshSession } from './session';

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

    if (error.response?.status === 401 && !isAuthCall) {
      // La sesión no se pudo renovar: la ruta protegida redirige al login
      window.dispatchEvent(new Event('auth-error'));
    }
    return Promise.reject(error);
  }
);

export default api;
