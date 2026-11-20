import pino from 'pino';

/**
 * Logs en JSON (una línea por evento) con requestId y tenantId, listos para
 * cualquier agregador. Nivel con LOG_LEVEL (por defecto info; silencioso en tests).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.VITEST ? 'silent' : 'info'),
  base: { service: 'vortex-beauty-api' },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    censor: '[oculto]',
  },
});

/**
 * Ruta sin query y sin las credenciales que viajan en ella: el enlace de «gestionar mi cita»
 * (/manage/<token>) y el del calendario del celular (/api/calendar/<token>.ics). Quien lea el
 * registro no debe poder abrirlos.
 */
export function safeLogUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  return url
    .split('?')[0]
    .replace(/(\/manage\/)[^/]+/, '$1[oculto]')
    .replace(/(\/api\/calendar\/)[^/]+(\.ics)$/, '$1[oculto]$2');
}
