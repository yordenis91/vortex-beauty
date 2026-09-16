import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://deploy-vortex-backend.wgteoi.easypanel.host/api';

// Instancia de axios separada de `api.ts`: usa su propia llave de token
// (`platform_token`) para que la sesión de Super Admin nunca se mezcle con
// la sesión de un salón (tenant) en el mismo navegador.
export const platformApi = axios.create({
  baseURL: `${API_BASE_URL}/platform`,
  headers: {
    'Content-Type': 'application/json',
  },
});

platformApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('platform_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

platformApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('platform_token');
      window.dispatchEvent(new Event('platform-auth-error'));
    }
    return Promise.reject(error);
  }
);

export default platformApi;
