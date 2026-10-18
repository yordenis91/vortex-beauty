import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';
import { config } from './config';
import { logger } from './lib/logger';
import { captureError } from './lib/monitoring';
import { basePrisma } from './prismaClient';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth';
import clientRoutes from './routes/clients';
import serviceRoutes from './routes/services';
import categoryRoutes from './routes/categories';
import appointmentRoutes from './routes/appointments';
import notificationRoutes from './routes/notifications';
import portalRoutes from './routes/portal';
import overridesRoutes from './routes/overrides';
import settingsRoutes from './routes/settings';
import galleryRoutes from './routes/gallery';
import closedDatesRoutes from './routes/closedDates';
import professionalRoutes from './routes/professionals';
import resourceRoutes from './routes/resources';
import platformAuthRoutes from './routes/platformAuth';
import platformTenantsRoutes from './routes/platformTenants';
import platformPlansRoutes from './routes/platformPlans';
import platformDashboardRoutes from './routes/platformDashboard';
import publicTenantsRoutes from './routes/publicTenants';
import billingRoutes from './routes/billing';
import mercadoPagoWebhookRoutes from './routes/mercadoPagoWebhook';
import publicBookingRoutes from './routes/publicBooking';
import telegramWebhookRoutes from './routes/telegramWebhook';

const app = express();

// Detrás de Traefik/Easypanel: sin esto req.ip (y los límites por IP) verían siempre la IP del proxy.
app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : 1);

// Orígenes de desarrollo local, siempre permitidos.
const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5175',
  'http://localhost:3002',
];

// Registro de peticiones en JSON con requestId (se devuelve en X-Request-Id) y tenantId.
app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id = typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    // Las comprobaciones de salud no ensucian el registro
    autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/api/health' },
    customProps: (req) => ({ tenantId: (req as express.Request).user?.tenantId }),
    customLogLevel: (_req, res, error) => (error || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url?.split('?')[0] }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  })
);

// 1. Configuramos CORS explícitamente para tu frontend
app.use(cors({
  origin: [...DEV_ORIGINS, ...config.corsOrigins],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Cabeceras de seguridad HTTP básicas (CSP desactivada: esta API no sirve HTML).
app.use(helmet({ contentSecurityPolicy: false }));

// 2. Parseo de body
// 3 MB: una imagen de hasta 1,5 MB en base64 (ver lib/images.ts) más el resto del
// cuerpo. Bajará a pocos KB cuando las imágenes pasen a almacenamiento de objetos.
app.use(express.json({ limit: '3mb', strict: true }));
app.use(express.urlencoded({ limit: '100kb', extended: true }));

// Límite de intentos de login/registro: mitiga fuerza bruta contra cuentas.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Inténtalo de nuevo en unos minutos.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/platform/auth/login', authLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/notifications', notificationRoutes);

// Portal routes (for CLIENT users)
app.use('/api/portal', portalRoutes);

// Schedule overrides routes
app.use('/api/overrides', overridesRoutes);

// Settings routes
app.use('/api/settings', settingsRoutes);

// Gallery routes
app.use('/api/gallery', galleryRoutes);

// Closed dates routes
app.use('/api/closed-dates', closedDatesRoutes);

// Professionals routes
app.use('/api/professionals', professionalRoutes);

// Portal de plataforma (Super Admin): namespace separado de las rutas de
// tenant de arriba, con su propio sistema de auth (ver middleware/platformAuth).
app.use('/api/platform/auth', platformAuthRoutes);
app.use('/api/platform/tenants', platformTenantsRoutes);
app.use('/api/platform/plans', platformPlansRoutes);
app.use('/api/platform/dashboard', platformDashboardRoutes);

// Info pública por salón (sin auth): usada por la página de registro /:tenantSlug/register
app.use('/api/public/tenants', publicTenantsRoutes);
// Reserva pública sin cuenta
app.use('/api/public/booking', publicBookingRoutes);
app.use('/api/telegram', telegramWebhookRoutes);

// Facturación del propio salón a la plataforma (Mercado Pago)
app.use('/api/billing', billingRoutes);
app.use('/api/webhooks/mercadopago', mercadoPagoWebhookRoutes);

// Health check: comprueba también la base de datos
const health: express.RequestHandler = async (_req, res) => {
  try {
    await basePrisma.$queryRaw`SELECT 1`;
    res.json({ status: 'OK', timestamp: new Date().toISOString(), queue: config.queueMode });
  } catch (error) {
    logger.error({ err: error }, 'health check: la base de datos no responde');
    res.status(503).json({ status: 'DOWN', timestamp: new Date().toISOString() });
  }
};
app.get('/api/health', health);
app.get('/health', health);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Cuerpo demasiado grande o JSON roto: error del cliente, no del servidor
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'La petición es demasiado grande' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });

  const requestId = (req as express.Request & { id?: string }).id;
  req.log?.error({ err }, 'error no controlado');
  captureError(err, { requestId, tenantId: req.user?.tenantId, path: req.path });
  res.status(500).json({ error: 'Error interno del servidor', requestId });
});

export default app;
