import express from 'express';
import { zodResponse } from '../lib/validation';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { imageSchema } from '../lib/images';
import { runInTransaction } from '../lib/db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { requirePermission } from '../middleware/can';

const router = express.Router();

// Lectura: cualquier usuario del panel (un STAFF necesita ver clientes para agendar).
// Escritura: dueño y administradores.
router.use(authenticateToken);

const clientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  code: z.string().optional(),
  displayName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  imageUrl: imageSchema.optional(),
});

const createClientSchema = clientSchema.extend({
  username: z.string().min(1).optional(),
  password: z.string().min(8).max(128).optional(),
  sendWelcomeEmail: z.boolean().optional(),
});

const updateClientSchema = clientSchema.partial();

// GET /api/clients - List all clients
router.get('/', requirePermission('customers:read'), async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : '';
    const clients = await prisma.client.findMany({
      where: {
        tenantId: req.user!.tenantId,
        ...(search
          ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }, { phone: { contains: search } }] }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: 2000,
    });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/clients/:id - Get single client
router.get('/:id', requirePermission('customers:read'), async (req, res) => {
  try {
    const client = await prisma.client.findFirst({
      where: { id: req.params.id as string, tenantId: req.user!.tenantId },
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
router.post('/', requireAdmin, async (req, res) => {
  try {
    const parsed = createClientSchema.parse(req.body);
    const {
      username,
      password,
      sendWelcomeEmail,
      ...clientData
    } = parsed;

    const tenantId = req.user!.tenantId;
    const result = await runInTransaction(async (tx) => {
      const newClient = await tx.client.create({
        data: {
          ...clientData,
          userId: req.userId!,
          tenantId,
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
            tenantId,
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
      return res.status(400).json(zodResponse(error));
    }
    
    console.error(error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /api/clients/:id - Update client
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const data = updateClientSchema.parse(req.body);

    const client = await prisma.client.updateMany({
      where: { id: req.params.id as string, tenantId: req.user!.tenantId },
      data: {
        ...data,
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
      return res.status(400).json(zodResponse(error));
    }
    
    console.error(error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

// DELETE /api/clients/:id - Delete client
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    // Verify client exists and belongs to user
    const existingClient = await prisma.client.findFirst({
      where: { id: req.params.id as string, tenantId: req.user!.tenantId },
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
      return res.status(400).json(zodResponse(error));
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