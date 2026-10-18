import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno obligatoria ${name}`);
  }
  return value;
}

const isProduction = process.env.NODE_ENV === 'production';

// PLATFORM_JWT_SECRET debería ser distinto de JWT_SECRET: un token de tenant nunca
// debe servir en el portal de plataforma.
const jwtSecret = required('JWT_SECRET');
const platformJwtSecret = process.env.PLATFORM_JWT_SECRET || jwtSecret;
if (isProduction && !process.env.PLATFORM_JWT_SECRET) {
  console.warn('[config] PLATFORM_JWT_SECRET no está definida: se reutiliza JWT_SECRET. Define una distinta en producción.');
}

const databaseUrl = required('DATABASE_URL');

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 3001,
  databaseUrl,
  jwtSecret,
  platformJwtSecret,
  // URL pública del frontend, para los enlaces de los correos ("gestionar mi cita").
  appPublicUrl: (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, ''),
  // URL pública (https) del API: Telegram la usa para llamar al webhook. Si falta, se toma de la petición.
  apiPublicUrl: (process.env.API_PUBLIC_URL || '').replace(/\/$/, ''),
  // Cola de trabajos (pg-boss): puede usar otra conexión con permiso para crear su schema.
  queueDatabaseUrl: process.env.QUEUE_DATABASE_URL || databaseUrl,
  // 'memory' guarda los trabajos en memoria (tests); 'off' no encola nada.
  queueMode: (process.env.QUEUE_MODE || 'pgboss') as 'pgboss' | 'memory' | 'off',
  // Ejecuta el worker dentro del proceso de la API. Pon false si lo despliegas aparte.
  workerEmbedded: process.env.WORKER_EMBEDDED !== 'false',
  // Duración del access token y de la sesión renovable
  accessTokenTtl: '15m' as const,
  refreshTtlDays: Number(process.env.REFRESH_TTL_DAYS) || 30,
  // SameSite de la cookie de sesión. Usa 'none' solo si frontend y API están en dominios distintos (exige HTTPS).
  cookieSameSite: (process.env.COOKIE_SAMESITE || 'lax') as 'lax' | 'strict' | 'none',
  turnstileSecret: process.env.TURNSTILE_SECRET || '',
  // Orígenes permitidos por CORS, separados por comas (CORS_ORIGINS). Si no se
  // define, cae en los dominios de la demo actual en Easypanel.
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : [
        'https://deploy-vortex-frontend.wgteoi.easypanel.host',
        'https://deploy-vortex-backend.wgteoi.easypanel.host',
      ],
};
