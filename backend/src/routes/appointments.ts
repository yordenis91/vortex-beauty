import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Validation schemas
const createAppointmentSchema = z.object({
  date: z.string().datetime('Invalid date format'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in format HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be in format HH:mm'),
  clientId: z.string().uuid('Invalid client ID'),
  productId: z.string().uuid('Invalid product ID'),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).default('SCHEDULED'),
  notes: z.string().optional(),
});

const updateAppointmentSchema = createAppointmentSchema.partial();

// GET /api/appointments - Get all appointments for the authenticated user
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      include: {
        client: true,
        product: true,
      },
      orderBy: { date: 'asc' },
    });

    res.json(appointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// GET /api/appointments/:id - Get a specific appointment
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params as { id: string };

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        client: true,
        product: true,
      },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json(appointment);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// POST /api/appointments - Create a new appointment
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const validatedData = createAppointmentSchema.parse(req.body);

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: validatedData.clientId },
    });

    if (!client) {
      return res.status(400).json({ error: 'Invalid client' });
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: validatedData.productId },
    });

    if (!product) {
      return res.status(400).json({ error: 'Invalid product' });
    }

    // Check for conflicting appointments
    const conflictingAppointment = await prisma.appointment.findFirst({
      where: {
        clientId: validatedData.clientId,
        date: new Date(validatedData.date),
        status: { not: 'CANCELLED' },
      },
    });

    if (conflictingAppointment) {
      return res.status(400).json({ error: 'Client already has an appointment on this date' });
    }

    const appointment = await prisma.appointment.create({
      data: {
        date: new Date(validatedData.date),
        startTime: validatedData.startTime,
        endTime: validatedData.endTime,
        status: validatedData.status,
        notes: validatedData.notes,
        clientId: validatedData.clientId,
        productId: validatedData.productId,
      },
      include: {
        client: true,
        product: true,
      },
    });

    res.status(201).json(appointment);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }

    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// PUT /api/appointments/:id - Update an appointment
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const validatedData = updateAppointmentSchema.parse(req.body);

    // Verify appointment exists
    const existingAppointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!existingAppointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // If client is being changed, verify new client exists
    if (validatedData.clientId && validatedData.clientId !== existingAppointment.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: validatedData.clientId },
      });

      if (!client) {
        return res.status(400).json({ error: 'Invalid client' });
      }
    }

    // If product is being changed, verify new product exists
    if (validatedData.productId && validatedData.productId !== existingAppointment.productId) {
      const product = await prisma.product.findUnique({
        where: { id: validatedData.productId },
      });

      if (!product) {
        return res.status(400).json({ error: 'Invalid product' });
      }
    }

    const dataToUpdate: any = {};
    if (validatedData.date) dataToUpdate.date = new Date(validatedData.date);
    if (validatedData.startTime) dataToUpdate.startTime = validatedData.startTime;
    if (validatedData.endTime) dataToUpdate.endTime = validatedData.endTime;
    if (validatedData.status) dataToUpdate.status = validatedData.status;
    if (validatedData.notes !== undefined) dataToUpdate.notes = validatedData.notes;
    if (validatedData.clientId) dataToUpdate.clientId = validatedData.clientId;
    if (validatedData.productId) dataToUpdate.productId = validatedData.productId;

    const appointment = await prisma.appointment.update({
      where: { id },
      data: dataToUpdate,
      include: {
        client: true,
        product: true,
      },
    });

    res.json(appointment);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }

    console.error('Error updating appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// DELETE /api/appointments/:id - Delete an appointment
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params as { id: string };

    // Verify appointment exists
    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    await prisma.appointment.delete({
      where: { id },
    });

    res.json({ message: 'Appointment deleted successfully' });
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return res.status(409).json({
        error: 'Cannot delete this appointment due to related data in the system.',
      });
    }
    console.error('Error deleting appointment:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

export default router;
