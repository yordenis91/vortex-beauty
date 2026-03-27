import express from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

const projectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['PLANNING', 'ACTIVE', 'COMPLETED', 'ON_HOLD']).optional(),
  clientId: z.string(),
});

// GET /api/projects - List all projects
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: (req as any).userId },
      include: { client: true, invoices: true },
    });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/projects - Create new project
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const data = projectSchema.parse(req.body);

    const project = await prisma.project.create({
      data: { ...data, userId: (req as any).userId },
      include: { client: true },
    });

    res.status(201).json(project);
  } catch (error: any) { // Le decimos a TS que confíe en nosotros aquí temporalmente
    // Usamos el método interno de Zod para verificar o simplemente asumimos si tiene name
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    
    console.error(error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /api/projects/:id - Update project
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const data = projectSchema.parse(req.body);

    const project = await prisma.project.update({
      where: { id: req.params.id as string },
      data,
      include: { client: true },
    });

    res.json(project);
  } catch (error: any) { // Le decimos a TS que confíe en nosotros aquí temporalmente
    // Usamos el método interno de Zod para verificar o simplemente asumimos si tiene name
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    
    console.error(error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await prisma.project.delete({
      where: { id: req.params.id as string },
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;