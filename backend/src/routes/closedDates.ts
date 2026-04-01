import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

const createClosedDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format YYYY-MM-DD'),
  reason: z.string().optional(),
});

// GET /api/closed-dates
router.get('/', authenticateToken, async (req, res) => {
  try {
    const closedDates = await prisma.closedDate.findMany({
      orderBy: { date: 'asc' },
    });
    res.json(closedDates);
  } catch (error) {
    console.error('Error fetching closed dates:', error);
    res.status(500).json({ error: 'Failed to fetch closed dates' });
  }
});

// POST /api/closed-dates
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const parsed = createClosedDateSchema.parse(req.body);

    const existing = await prisma.closedDate.findUnique({ where: { date: parsed.date } });
    if (existing) {
      return res.status(409).json({ error: 'Closed date already exists for this date' });
    }

    const created = await prisma.closedDate.create({
      data: {
        date: parsed.date,
        reason: parsed.reason,
      },
    });

    res.status(201).json(created);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    console.error('Error creating closed date:', error);
    res.status(500).json({ error: 'Failed to create closed date' });
  }
});

// DELETE /api/closed-dates/:id
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.closedDate.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Closed date not found' });
    }

    await prisma.closedDate.delete({ where: { id } });
    res.json({ message: 'Closed date deleted successfully' });
  } catch (error) {
    console.error('Error deleting closed date:', error);
    res.status(500).json({ error: 'Failed to delete closed date' });
  }
});

export default router;
