import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Log all available models on startup
console.log('[SETTINGS] BusinessHour model exists:', 'businessHour' in prisma);

// Test route - no authentication required
router.get('/health', async (req, res) => {
  try {
    console.log('[SETTINGS] Health check called');
    const count = await prisma.businessHour.count();
    console.log('[SETTINGS] BusinessHour count:', count);
    res.json({ status: 'OK', businessHourCount: count });
  } catch (error: any) {
    console.error('[SETTINGS] Health check error:', error?.message);
    res.status(500).json({ error: error?.message });
  }
});

// Validation schemas
const updateBusinessHourSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in format HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be in format HH:mm'),
  isOpen: z.boolean().default(true),
});

// Helper: Initialize default business hours if they don't exist
const initializeDefaultBusinessHours = async (): Promise<void> => {
  try {
    console.log('Checking if business hours need initialization...');

    const existingCount = await prisma.businessHour.count();

    if (existingCount === 0) {
      console.log('No business hours found, creating defaults...');

      const defaultHours = [
        { dayOfWeek: 0, startTime: '09:00', endTime: '18:00', isOpen: false }, // Domingo (cerrado)
        { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isOpen: true },  // Lunes
        { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', isOpen: true },  // Martes
        { dayOfWeek: 3, startTime: '09:00', endTime: '18:00', isOpen: true },  // Miércoles
        { dayOfWeek: 4, startTime: '09:00', endTime: '18:00', isOpen: true },  // Jueves
        { dayOfWeek: 5, startTime: '09:00', endTime: '18:00', isOpen: true },  // Viernes
        { dayOfWeek: 6, startTime: '09:00', endTime: '18:00', isOpen: false }, // Sábado (cerrado)
      ];

      await prisma.businessHour.createMany({
        data: defaultHours,
      });

      console.log('Default business hours created successfully');
    } else {
      console.log(`Business hours already exist (${existingCount} records), skipping initialization`);
    }
  } catch (error) {
    console.error('Error initializing business hours:', error);
    throw error;
  }
};

// GET /api/settings/business-hours - Get all business hours
router.get('/business-hours', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('GET /api/settings/business-hours called');

    // Initialize default hours if they don't exist
    await initializeDefaultBusinessHours();

    const businessHours = await prisma.businessHour.findMany({
      orderBy: { dayOfWeek: 'asc' },
    });

    console.log('Business hours retrieved:', businessHours);
    res.json(businessHours);
  } catch (error: any) {
    console.error('Error fetching business hours:', error);
    console.error('Error message:', error?.message);
    console.error('Error code:', error?.code);
    res.status(500).json({
      error: 'Failed to fetch business hours',
      details: error?.message || 'Unknown error'
    });
  }
});

// GET /api/settings/business-hours/:dayOfWeek - Get business hours for a specific day
router.get('/business-hours/:dayOfWeek', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { dayOfWeek } = req.params;
    const day = parseInt(dayOfWeek as string);

    if (isNaN(day) || day < 0 || day > 6) {
      return res.status(400).json({ error: 'Invalid day of week (0-6)' });
    }

    const businessHour = await prisma.businessHour.findUnique({
      where: { dayOfWeek: day },
    });

    if (!businessHour) {
      return res.status(404).json({ error: 'Business hour not found for this day' });
    }

    res.json(businessHour);
  } catch (error) {
    console.error('Error fetching business hour:', error);
    res.status(500).json({ error: 'Failed to fetch business hour' });
  }
});

// PUT /api/settings/business-hours/:dayOfWeek - Update business hours for a specific day
router.put('/business-hours/:dayOfWeek', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { dayOfWeek } = req.params;
    const day = parseInt(dayOfWeek as string);

    if (isNaN(day) || day < 0 || day > 6) {
      return res.status(400).json({ error: 'Invalid day of week (0-6)' });
    }

    const validatedData = updateBusinessHourSchema.parse(req.body);

    // Verify the day matches (security check)
    if (validatedData.dayOfWeek !== day) {
      return res.status(400).json({ error: 'Day of week in URL does not match request body' });
    }

    // Ensure the record exists (or create it)
    let businessHour = await prisma.businessHour.findUnique({
      where: { dayOfWeek: day },
    });

    if (!businessHour) {
      businessHour = await prisma.businessHour.create({
        data: validatedData,
      });
    } else {
      businessHour = await prisma.businessHour.update({
        where: { dayOfWeek: day },
        data: validatedData,
      });
    }

    res.json(businessHour);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }

    console.error('Error updating business hour:', error);
    res.status(500).json({ error: 'Failed to update business hour' });
  }
});

export default router;
