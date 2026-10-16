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
