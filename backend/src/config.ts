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

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 3001,
  databaseUrl: required('DATABASE_URL'),
  jwtSecret,
  platformJwtSecret,
  // Orígenes permitidos por CORS, separados por comas (CORS_ORIGINS). Si no se
  // define, cae en los dominios de la demo actual en Easypanel.
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : [
        'https://deploy-vortex-frontend.wgteoi.easypanel.host',
        'https://deploy-vortex-backend.wgteoi.easypanel.host',
      ],
};
