import express from 'express';
import { authenticateToken } from '../middleware/auth';
import prisma from '../prismaClient';

const router = express.Router();

interface AuthRequest extends express.Request {
  userId?: string;
  user?: {
    userId: string;
    role: 'ADMIN' | 'CLIENT';
    clientId?: string;
  };
}

/**
 * GET /api/portal/my-invoices
 * Retorna las facturas del cliente autenticado
 * Solo pueden ver facturas donde clientId coincida con su clientId en el token
 */
router.get('/my-invoices', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    const clientId = req.user?.clientId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Si el usuario es CLIENT pero no tiene un clientId asignado, retornar array vacío
    if (!clientId) {
      return res.json([]);
    }

    // Obtener facturas del cliente
    const invoices = await prisma.invoice.findMany({
      where: {
        clientId: clientId, // Filtrar por clientId del usuario
      },
      include: {
        client: {
          select: { id: true, name: true, email: true },
        },
        project: {
          select: { id: true, name: true },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(invoices);
  } catch (error) {
    console.error('Error fetching client invoices:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/portal/my-profile
 * Retorna información del perfil del cliente autenticado
 */
router.get('/my-profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        clientId: true,
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
            phone: true,
            address: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/portal/my-subscriptions
 * Retorna las suscripciones del cliente autenticado
 */
router.get('/my-subscriptions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user?.clientId;

    if (!clientId) {
      return res.json([]);
    }

    const subscriptions = await prisma.subscription.findMany({
      where: {
        clientId: clientId,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            billingCycle: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(subscriptions);
  } catch (error) {
    console.error('Error fetching client subscriptions:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/portal/my-appointments
 * Retorna las citas del cliente autenticado
 */
router.get('/my-appointments', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user?.clientId;

    if (!clientId) {
      return res.json([]);
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        clientId: clientId,
      },
      include: {
        client: {
          select: { id: true, name: true, email: true },
        },
        product: {
          select: { id: true, name: true, price: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    res.json(appointments);
  } catch (error) {
    console.error('Error fetching client appointments:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/portal/appointments
 * Crea una nueva cita para el cliente autenticado
 */
router.post('/appointments', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { productId, date, startTime, endTime, notes } = req.body;
    const clientId = req.user?.clientId;
    const userId = req.user?.userId;

    // Validar que el cliente existe
    if (!clientId) {
      return res.status(400).json({ error: 'Cliente no identificado' });
    }

    // Validar campos requeridos
    if (!productId || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Campos requeridos faltantes' });
    }

    // Verificar que el producto existe
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(400).json({ error: 'Servicio no encontrado' });
    }

    // Crear la cita
    const appointment = await prisma.appointment.create({
      data: {
        clientId,
        productId,
        date: new Date(date),
        startTime,
        endTime,
        notes: notes || '',
        status: 'SCHEDULED',
      },
      include: {
        client: {
          select: { id: true, name: true, email: true },
        },
        product: {
          select: { id: true, name: true, price: true },
        },
      },
    });

    res.status(201).json(appointment);
  } catch (error) {
    console.error('Error creating appointment:', error);
    return res.status(500).json({ error: 'Error al crear la cita' });
  }
});

/**
 * GET /api/portal/products
 * Retorna los productos/servicios disponibles para clientes
 */
router.get('/products', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        isPublic: true,
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
