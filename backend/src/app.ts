import { config } from './config';
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

// 1. Configuramos CORS explícitamente para tu frontend
app.use(cors({
  origin: [...DEV_ORIGINS, ...config.corsOrigins],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Cabeceras de seguridad HTTP básicas (CSP desactivada: esta API no sirve HTML).
app.use(helmet({ contentSecurityPolicy: false }));

// 2. Parseo de body
// 10mb cubre imágenes de perfil/galería en base64; bajará más cuando se
// migren a almacenamiento de objetos con subida directa por URL firmada.
app.use(express.json({ limit: '10mb', strict: true }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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

// Facturación del propio salón a la plataforma (Mercado Pago)
app.use('/api/billing', billingRoutes);
app.use('/api/webhooks/mercadopago', mercadoPagoWebhookRoutes);

// Health check
const healthResponse = { status: 'OK', timestamp: new Date().toISOString() };
app.get('/api/health', (req, res) => {
  res.json(healthResponse);
});
app.get('/health', (req, res) => {
  res.json(healthResponse);
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

export default app;
