import express from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

const clientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  code: z.string().optional(),
  displayName: z.string().optional(),
  type: z.enum(['CUSTOMER', 'SUPPLIER']).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  groupId: z.string().optional(),
  ownerId: z.string().optional(),
  taxId: z.string().optional(),
  imageUrl: z.string().optional(),
});

const createClientSchema = clientSchema.extend({
  username: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  sendWelcomeEmail: z.boolean().optional(),
});

const updateClientSchema = clientSchema.partial();

// GET /api/clients - List all clients
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      where: { userId: (req as any).userId },
      include: { projects: true, invoices: true },
    });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/clients/:id - Get single client
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const client = await prisma.client.findFirst({
      where: { id: req.params.id as string, userId: (req as any).userId },
      include: { projects: true, invoices: true },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/clients - Create new client
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const parsed = createClientSchema.parse(req.body);
    const {
      username,
      password,
      sendWelcomeEmail,
      ...clientData
    } = parsed;

    const result = await prisma.$transaction(async (tx) => {
      const newClient = await tx.client.create({
        data: {
          ...clientData,
          type: clientData.type || 'CUSTOMER',
          userId: (req as any).userId,
        },
      });

      let newUser = null;
      if (username && password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        newUser = await tx.user.create({
          data: {
            email: clientData.email,
            username,
            password: hashedPassword,
            name: clientData.displayName || clientData.name,
            role: 'CLIENT',
            clientId: newClient.id,
          },
        });

        if (sendWelcomeEmail) {
          console.log('Sending welcome email to...', clientData.email);
        }
      }

      return { newClient, newUser };
    });

    res.status(201).json(result.newClient);
  } catch (error: any) { // Le decimos a TS que confíe en nosotros aquí temporalmente
    // Usamos el método interno de Zod para verificar o simplemente asumimos si tiene name
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    
    console.error(error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /api/clients/:id - Update client
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const data = updateClientSchema.parse(req.body);

    const client = await prisma.client.updateMany({
      where: { id: req.params.id as string, userId: (req as any).userId },
      data: {
        ...data,
        type: data.type || undefined,
      },
    });

    if (client.count === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const updatedClient = await prisma.client.findUnique({
      where: { id: req.params.id as string },
    });

    res.json(updatedClient);
  } catch (error: any) { // Le decimos a TS que confíe en nosotros aquí temporalmente
    // Usamos el método interno de Zod para verificar o simplemente asumimos si tiene name
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    
    console.error(error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

// DELETE /api/clients/:id - Delete client
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Verify client exists and belongs to user
    const existingClient = await prisma.client.findFirst({
      where: { id: req.params.id as string, userId: (req as any).userId },
    });

    if (!existingClient) {
      return res.status(404).json({ error: 'Client not found' });
    }

    await prisma.client.delete({
      where: { id: req.params.id as string },
    });

    res.json({ message: 'Client deleted successfully' });
  } catch (error: any) { // Le decimos a TS que confíe en nosotros aquí temporalmente
    // Usamos el método interno de Zod para verificar o simplemente asumimos si tiene name
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return res.status(409).json({
        error: 'No se puede eliminar este registro porque tiene datos asociados en el sistema (ej. facturas, proyectos o suscripciones).',
      });
    }
    
    console.error(error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;