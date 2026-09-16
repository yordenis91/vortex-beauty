import "dotenv/config";
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import prisma from './prismaClient';
import authRoutes from './routes/auth';
import clientRoutes from './routes/clients';
import projectRoutes from './routes/projects';
import invoiceRoutes from './routes/invoices';
import productRoutes from './routes/products';
import categoryRoutes from './routes/categories';
import subscriptionRoutes from './routes/subscriptions';
import ticketRoutes from './routes/tickets';
import knowledgeBaseRoutes from './routes/knowledgeBase';
import appointmentRoutes from './routes/appointments';
import notificationRoutes from './routes/notifications';
import portalRoutes from './routes/portal';
import overridesRoutes from './routes/overrides';
import settingsRoutes from './routes/settings';
import galleryRoutes from './routes/gallery';
import closedDatesRoutes from './routes/closedDates';
import staffRoutes from './routes/staff';
import platformAuthRoutes from './routes/platformAuth';
import platformTenantsRoutes from './routes/platformTenants';
import platformPlansRoutes from './routes/platformPlans';
import platformDashboardRoutes from './routes/platformDashboard';

const app = express();
const PORT = process.env.PORT || 3001;

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

// Orígenes de producción/staging: configurables por entorno (CORS_ORIGINS,
// separados por comas). Si no se define, cae en los dominios de despliegue
// actuales para no romper el entorno en producción.
const DEFAULT_PROD_ORIGINS = [
  'https://deploy-vortex-frontend.wgteoi.easypanel.host',
  'https://deploy-vortex-backend.wgteoi.easypanel.host',
];

const EXTRA_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : DEFAULT_PROD_ORIGINS;

// 1. Configuramos CORS explícitamente para tu frontend
app.use(cors({
  origin: [...DEV_ORIGINS, ...EXTRA_ORIGINS],
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
app.use('/api/projects', projectRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/knowledge-base', knowledgeBaseRoutes);
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

// Staff routes
app.use('/api/staff', staffRoutes);

// Portal de plataforma (Super Admin): namespace separado de las rutas de
// tenant de arriba, con su propio sistema de auth (ver middleware/platformAuth).
app.use('/api/platform/auth', platformAuthRoutes);
app.use('/api/platform/tenants', platformTenantsRoutes);
app.use('/api/platform/plans', platformPlansRoutes);
app.use('/api/platform/dashboard', platformDashboardRoutes);

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

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export { prisma };