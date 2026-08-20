import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Todas las rutas de profesionales son exclusivas de ADMIN.
router.use(authenticateToken, requireAdmin);

const staffSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  color: z.string().optional(),
  isActive: z.boolean().optional(),
});

const updateStaffSchema = staffSchema.partial();

// GET /api/staff - Lista de profesionales
router.get('/', async (req, res) => {
  try {
    const { active } = req.query;
    const where = active === 'true' ? { isActive: true } : {};

    const staff = await prisma.staff.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json(staff);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// GET /api/staff/:id - Un profesional
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params as { id: string };

    const staff = await prisma.staff.findUnique({ where: { id } });

    if (!staff) {
      return res.status(404).json({ error: 'Staff not found' });
    }

    res.json(staff);
  } catch (error) {
    console.error('Error fetching staff member:', error);
    res.status(500).json({ error: 'Failed to fetch staff member' });
  }
});

// POST /api/staff - Crear profesional
router.post('/', async (req, res) => {
  try {
    const data = staffSchema.parse(req.body);

    const staff = await prisma.staff.create({
      data: { ...data, email: data.email || undefined },
    });

    res.status(201).json(staff);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }

    console.error('Error creating staff member:', error);
    res.status(500).json({ error: 'Failed to create staff member' });
  }
});

// PUT /api/staff/:id - Actualizar profesional
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const data = updateStaffSchema.parse(req.body);

    const existing = await prisma.staff.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Staff not found' });
    }

    const staff = await prisma.staff.update({
      where: { id },
      data: { ...data, email: data.email || undefined },
    });

    res.json(staff);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }

    console.error('Error updating staff member:', error);
    res.status(500).json({ error: 'Failed to update staff member' });
  }
});

// DELETE /api/staff/:id - Eliminar profesional
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params as { id: string };

    const existing = await prisma.staff.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Staff not found' });
    }

    await prisma.staff.delete({ where: { id } });

    res.json({ message: 'Staff member deleted successfully' });
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return res.status(409).json({
        error: 'No se puede eliminar: tiene citas asociadas. Desactívalo en su lugar.',
      });
    }
    console.error('Error deleting staff member:', error);
    res.status(500).json({ error: 'Failed to delete staff member' });
  }
});

export default router;
