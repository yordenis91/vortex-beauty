import * as Sentry from '@sentry/node';

/** Errores a Sentry solo si SENTRY_DSN está definido. */
const enabled = !!process.env.SENTRY_DSN;

if (enabled) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0,
  });
}

export function captureError(error: unknown, context?: { requestId?: string; tenantId?: string; path?: string }) {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    if (context?.requestId) scope.setTag('requestId', context.requestId);
    if (context?.tenantId) scope.setTag('tenantId', context.tenantId);
    if (context?.path) scope.setContext('request', { path: context.path });
    Sentry.captureException(error);
  });
}
