import express from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

const clientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
});

// GET /api/clients - List all clients
router.get('/', authenticateToken, async (req, res) => {
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
router.get('/:id', authenticateToken, async (req, res) => {
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
router.post('/', authenticateToken, async (req, res) => {
  try {
    const data = clientSchema.parse(req.body);

    const client = await prisma.client.create({
      data: { ...data, userId: (req as any).userId },
    });

    res.status(201).json(client);
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
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const data = clientSchema.parse(req.body);

    const client = await prisma.client.updateMany({
      where: { id: req.params.id as string, userId: (req as any).userId },
      data,
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
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const client = await prisma.client.deleteMany({
      where: { id: req.params.id as string, userId: (req as any).userId },
    });

    if (client.count === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ message: 'Client deleted successfully' });
  } catch (error: any) { // Le decimos a TS que confíe en nosotros aquí temporalmente
    // Usamos el método interno de Zod para verificar o simplemente asumimos si tiene name
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    
    console.error(error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;