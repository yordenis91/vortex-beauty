import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import notificationService from '../services/notificationService';
import {
  AvailabilityError,
  createAppointmentSafely,
  updateAppointmentSafely,
  isSerializationConflict,
  dayOfWeekFromDateString,
} from '../services/availabilityService';

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

// GET /api/appointments/fully-booked-dates - Get dates that are fully booked
router.get('/fully-booked-dates', authenticateToken, async (req, res) => {
  try {
    // Obtener todas las citas SCHEDULED y COMPLETED
    const appointments = await prisma.appointment.findMany({
      where: {
        status: {
          in: ['SCHEDULED', 'COMPLETED'],
        },
      },
      select: {
        date: true,
      },
    });

    // Agrupar citas por fecha (formato YYYY-MM-DD)
    const appointmentsByDate = new Map<string, number>();

    appointments.forEach((apt) => {
      const dateStr = apt.date.toISOString().split('T')[0]; // YYYY-MM-DD
      appointmentsByDate.set(dateStr, (appointmentsByDate.get(dateStr) || 0) + 1);
    });

    // Array para almacenar fechas completamente reservadas
    const fullyBookedDates: string[] = [];

    // Para cada fecha agrupada, verificar si está llena
    for (const [dateStr, appointmentCount] of appointmentsByDate.entries()) {
      // Obtener el día de la semana de la fecha (misma regla que availabilityService)
      const dayOfWeek = dayOfWeekFromDateString(dateStr);

      // Obtener BusinessHour para ese día
      const businessHour = await prisma.businessHour.findUnique({
        where: { dayOfWeek },
      });

      // Si la fecha tiene maxAppointments configurado y está llena, agregar al array
      if (businessHour && businessHour.maxAppointments > 0 && appointmentCount >= businessHour.maxAppointments) {
        fullyBookedDates.push(dateStr);
      }
    }

    res.json(fullyBookedDates);
  } catch (error) {
    console.error('Error fetching fully booked dates:', error);
    res.status(500).json({ error: 'Failed to fetch fully booked dates' });
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

    // Disponibilidad + creación: misma regla que usa el portal de clientas,
    // en una sola transacción serializable para que dos citas simultáneas
    // para el mismo hueco no puedan colarse las dos.
    let appointment;
    try {
      appointment = await createAppointmentSafely({
        dateStr: validatedData.date.split('T')[0],
        startTime: validatedData.startTime,
        endTime: validatedData.endTime,
        clientId: validatedData.clientId,
        productId: validatedData.productId,
        notes: validatedData.notes,
        status: validatedData.status,
      });
    } catch (availabilityError: any) {
      if (availabilityError instanceof AvailabilityError) {
        return res.status(availabilityError.status).json({ error: availabilityError.message });
      }
      if (isSerializationConflict(availabilityError)) {
        return res.status(409).json({ error: 'Alguien reservó ese horario justo antes. Prueba con otro horario.' });
      }
      throw availabilityError;
    }

    try {
      await notificationService.createNotification({
        type: 'SYSTEM',
        recipient: 'ADMIN',
        content: `Nueva cita agendada (admin): cliente ${appointment.client.name} - servicio ${appointment.product.name}, fecha ${new Date(appointment.date).toLocaleDateString('es-ES')} ${appointment.startTime}-${appointment.endTime}`,
      });

      await notificationService.createNotification({
        type: 'SYSTEM',
        recipient: appointment.clientId,
        clientId: appointment.clientId,
        content: `Tu cita para ${appointment.product.name} ha sido agendada para ${new Date(appointment.date).toLocaleDateString('es-ES')} a las ${appointment.startTime}.`,
      });
    } catch (notifError) {
      console.error('Error crearing appointment notifications:', notifError);
    }

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

    // Fecha/hora resultantes tras aplicar los cambios, para revalidar disponibilidad.
    const dateStr = validatedData.date
      ? validatedData.date.split('T')[0]
      : existingAppointment.date.toISOString().split('T')[0];
    const startTimeToCheck = validatedData.startTime || existingAppointment.startTime;
    const endTimeToCheck = validatedData.endTime || existingAppointment.endTime;
    const resultingStatus = validatedData.status || existingAppointment.status;

    // Solo hace falta comprobar el hueco si se reprograma la cita, o si vuelve
    // a quedar SCHEDULED tras no estarlo (p.ej. se reactiva una cancelada).
    // Cancelar nunca debe bloquearse por reglas de disponibilidad.
    const isRescheduling = Boolean(validatedData.date || validatedData.startTime || validatedData.endTime);
    const isReactivating = resultingStatus === 'SCHEDULED' && existingAppointment.status !== 'SCHEDULED';
    const skipAvailabilityCheck = resultingStatus === 'CANCELLED' || !(isRescheduling || isReactivating);

    const dataToUpdate: any = {};
    if (validatedData.date) dataToUpdate.date = new Date(`${dateStr}T00:00:00.000Z`);
    if (validatedData.startTime) dataToUpdate.startTime = validatedData.startTime;
    if (validatedData.endTime) dataToUpdate.endTime = validatedData.endTime;
    if (validatedData.status) dataToUpdate.status = validatedData.status;
    if (validatedData.notes !== undefined) dataToUpdate.notes = validatedData.notes;
    if (validatedData.clientId) dataToUpdate.clientId = validatedData.clientId;
    if (validatedData.productId) dataToUpdate.productId = validatedData.productId;

    let appointment;
    try {
      appointment = await updateAppointmentSafely({
        id,
        dateStr,
        startTime: startTimeToCheck,
        endTime: endTimeToCheck,
        data: dataToUpdate,
        skipAvailabilityCheck,
      });
    } catch (availabilityError: any) {
      if (availabilityError instanceof AvailabilityError) {
        return res.status(availabilityError.status).json({ error: availabilityError.message });
      }
      if (isSerializationConflict(availabilityError)) {
        return res.status(409).json({ error: 'Alguien reservó ese horario justo antes. Prueba con otro horario.' });
      }
      throw availabilityError;
    }

    // Notificar a la clienta si la cita se cancela
    const updatedStatus = dataToUpdate.status || existingAppointment.status;
    if (updatedStatus === 'CANCELLED' && existingAppointment.status !== 'CANCELLED') {
      try {
        if (appointment.clientId) {
          await notificationService.createNotification({
            type: 'SYSTEM',
            recipient: appointment.clientId,
            clientId: appointment.clientId,
            content: `Tu cita para ${appointment.product?.name ?? 'este servicio'} el ${new Date(appointment.date).toLocaleDateString('es-ES')} a las ${appointment.startTime} ha sido cancelada.`,
          });
        }

        await notificationService.createNotification({
          type: 'SYSTEM',
          recipient: 'ADMIN',
          content: `La cita #${appointment.id} ha sido cancelada por el admin.`,
        });
      } catch (notifError) {
        console.error('Error creating cancellation notifications:', notifError);
      }
    }

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

    try {
      if (appointment.clientId) {
        await notificationService.createNotification({
          type: 'SYSTEM',
          recipient: appointment.clientId,
          clientId: appointment.clientId,
          content: `Tu cita programada para ${new Date(appointment.date).toLocaleDateString('es-ES')} a las ${appointment.startTime} ha sido eliminada por el salón.`,
        });
      }

      await notificationService.createNotification({
        type: 'SYSTEM',
        recipient: 'ADMIN',
        content: `La cita #${appointment.id} ha sido eliminada del sistema.`,
      });
    } catch (notifError) {
      console.error('Error creating delete notifications:', notifError);
    }

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
