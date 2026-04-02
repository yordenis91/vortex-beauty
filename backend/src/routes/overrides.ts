import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

const scheduleOverrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido YYYY-MM-DD'),
  timeSlots: z.array(z.string().regex(/^\d{2}:\d{2}$/, 'Formato inválido HH:mm')).optional(),
});

// GET /api/overrides - List all schedule overrides
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const overrides = await prisma.scheduleOverride.findMany({
      orderBy: { date: 'asc' },
    });
    res.json(overrides);
  } catch (error) {
    console.error('Error fetching schedule overrides:', error);
    res.status(500).json({ error: 'Failed to fetch schedule overrides' });
  }
});

// GET /api/overrides/:date - Get override by date
router.get('/:date', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { date } = req.params;
    const parsed = scheduleOverrideSchema.pick({ date: true }).parse({ date });

    const override = await prisma.scheduleOverride.findUnique({
      where: { date: parsed.date },
    });

    if (!override) {
      return res.status(404).json({ error: 'Schedule override not found for this date' });
    }

    res.json(override);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    console.error('Error fetching schedule override:', error);
    res.status(500).json({ error: 'Failed to fetch schedule override' });
  }
});

// POST /api/overrides - Create a schedule override
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const parsed = scheduleOverrideSchema.parse(req.body);

    const existing = await prisma.scheduleOverride.findUnique({ where: { date: parsed.date } });
    if (existing) {
      return res.status(409).json({ error: 'Schedule override already exists for this date' });
    }

    const created = await prisma.scheduleOverride.create({
      data: {
        date: parsed.date,
        timeSlots: parsed.timeSlots ?? [],
      },
    });

    res.status(201).json(created);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    console.error('Error creating schedule override:', error);
    res.status(500).json({ error: 'Failed to create schedule override' });
  }
});

// PUT /api/overrides/:date - Update or create schedule override for date
router.put('/:date', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { date } = req.params;
    const parsed = scheduleOverrideSchema.parse({ date, ...req.body });

    const updated = await prisma.scheduleOverride.upsert({
      where: { date: parsed.date },
      update: { timeSlots: parsed.timeSlots ?? [] },
      create: { date: parsed.date, timeSlots: parsed.timeSlots ?? [] },
    });

    res.json(updated);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    console.error('Error updating schedule override:', error);
    res.status(500).json({ error: 'Failed to update schedule override' });
  }
});

// DELETE /api/overrides/:date - Remove schedule override for date
router.delete('/:date', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { date } = req.params;
    const parsed = scheduleOverrideSchema.pick({ date: true }).parse({ date });

    const existing = await prisma.scheduleOverride.findUnique({ where: { date: parsed.date } });
    if (!existing) {
      return res.status(404).json({ error: 'Schedule override not found for this date' });
    }

    await prisma.scheduleOverride.delete({ where: { date: parsed.date } });

    res.json({ message: 'Schedule override deleted, using default business hours for this date' });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    console.error('Error deleting schedule override:', error);
    res.status(500).json({ error: 'Failed to delete schedule override' });
  }
});

export default router;
