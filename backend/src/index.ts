import "dotenv/config";
import express from 'express';
import cors from 'cors';
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

const app = express();
const PORT = process.env.PORT || 3001;

// 1. Configuramos CORS explícitamente para tu frontend
app.use(cors({
  origin: [
    'http://localhost:5173', // Para cuando desarrollas en tu PC
    'http://localhost:5174', // Para cuando desarrollas en tu PC (Vite default)
    'http://localhost:3002', // Para cuando desarrollas en tu PC
    'https://deploy-vortex-frontend.wgteoi.easypanel.host' // ¡Tu frontend en producción!
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Parseo de body
app.use(express.json({ limit: '50mb', strict: true }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
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