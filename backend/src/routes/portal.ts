import express from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import prisma from '../prismaClient';
import { imageSchema } from '../lib/images';
import { runInTransaction } from '../lib/db';
import notificationService from '../services/notificationService';
import {
  cancelBooking,
  computeSlots,
  createBooking,
  toBookingHttpErrorOrThrow,
} from '../services/availability';
import { appointmentInclude, toAppointmentDto } from '../services/availability/dto';
import { getTenantTimezone } from '../lib/tenantInfo';
import { isValidDateString } from '../lib/time';

const router = express.Router();

// Rutas de la cuenta de cliente final (rol CLIENT).
router.use(authenticateToken);

const profileSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  imageUrl: true,
  clientId: true,
  client: { select: { id: true, name: true, email: true, phone: true, address: true, imageUrl: true } },
} as const;

// GET /api/portal/my-profile
router.get('/my-profile', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: profileSelect });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const profileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  address: z.string().max(500).optional(),
  imageUrl: imageSchema.optional(),
});

// PUT /api/portal/my-profile
router.put('/my-profile', validateBody(profileSchema), async (req, res) => {
  try {
    const { userId, tenantId, clientId } = req.user!;
    const { name, email, phone, address, imageUrl } = req.body as z.infer<typeof profileSchema>;

    if (email) {
      const taken = await prisma.user.findFirst({ where: { tenantId, email, id: { not: userId } }, select: { id: true } });
      if (taken) return res.status(409).json({ error: 'Ese correo ya está en uso en este salón' });
    }

    await runInTransaction(async (tx) => {
      if (name !== undefined || email !== undefined || imageUrl !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(name !== undefined && { name }),
            ...(email !== undefined && { email }),
            ...(imageUrl !== undefined && { imageUrl }),
          },
        });
      }
      if (clientId && (phone !== undefined || address !== undefined || email !== undefined || imageUrl !== undefined || name !== undefined)) {
        await tx.client.update({
          where: { id: clientId },
          data: {
            ...(name !== undefined && { name }),
            ...(phone !== undefined && { phone }),
            ...(address !== undefined && { address }),
            ...(email !== undefined && { email }),
            ...(imageUrl !== undefined && { imageUrl }),
          },
        });
      }
    });

    res.json(await prisma.user.findUnique({ where: { id: userId }, select: profileSelect }));
  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/portal/my-appointments
router.get('/my-appointments', async (req, res) => {
  try {
    const { clientId, tenantId } = req.user!;
    if (!clientId) return res.json([]);

    const appointments = await prisma.appointment.findMany({
      where: { clientId, tenantId },
      include: { client: { select: { id: true, name: true, email: true } }, service: { select: { id: true, name: true, price: true } }, professional: { select: { id: true, name: true } } },
      orderBy: { startsAt: 'asc' },
    });
    const timezone = await getTenantTimezone(tenantId);
    res.json(appointments.map((a) => toAppointmentDto(a, timezone)));
  } catch (error) {
    console.error('Error fetching client appointments:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const bookSchema = z.object({
  serviceId: z.string().uuid(),
  date: z.string().min(10),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  professionalId: z.union([z.string().uuid(), z.literal('any')]).nullable().optional(),
  notes: z.string().max(1000).optional(),
});

// POST /api/portal/appointments
router.post('/appointments', validateBody(bookSchema), async (req, res) => {
  try {
    const { clientId, tenantId } = req.user!;
    if (!clientId) return res.status(400).json({ error: 'Cliente no identificado' });
    const data = req.body as z.infer<typeof bookSchema>;

    const appointment = await createBooking({
      tenantId,
      serviceId: data.serviceId,
      clientId,
      dateStr: data.date.split('T')[0],
      startTime: data.startTime,
      professionalId: data.professionalId ?? 'any',
      notes: data.notes,
      source: 'PORTAL',
      forPublic: true,
      enforceWindow: true,
    });

    try {
      await notificationService.createNotification({
        type: 'SYSTEM',
        recipient: 'ADMIN',
        content: `Nueva cita agendada: ${appointment.client.name} (${appointment.client.email}) - ${appointment.serviceName}, ${appointment.date.split('T')[0]} ${appointment.startTime}-${appointment.endTime}`,
        tenantId,
      });
      await notificationService.createNotification({
        type: 'SYSTEM',
        recipient: clientId,
        clientId,
        content: `Tu cita ha sido agendada correctamente: ${appointment.serviceName} el ${appointment.date.split('T')[0]} a las ${appointment.startTime}.`,
        tenantId,
      });
    } catch (notifError) {
      console.error('Error creating appointment notifications:', notifError);
    }

    res.status(201).json(appointment);
  } catch (error) {
    const handled = toBookingHttpErrorOrThrow(error);
    return res.status(handled.status).json({ error: handled.message });
  }
});

// GET /api/portal/services — servicios que el cliente puede reservar
router.get('/services', async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      where: { tenantId: req.user!.tenantId, isPublic: true, onlineBookable: true, status: 'ACTIVE' },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/portal/professionals?serviceId=... — profesionales reservables
router.get('/professionals', async (req, res) => {
  try {
    const serviceId = req.query.serviceId as string | undefined;
    const professionals = await prisma.professional.findMany({
      where: {
        tenantId: req.user!.tenantId,
        isActive: true,
        acceptsOnlineBookings: true,
        ...(serviceId ? { services: { some: { serviceId } } } : {}),
      },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    });
    res.json(professionals);
  } catch (error) {
    console.error('Error fetching professionals:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/portal/appointments/:id/cancel
router.patch('/appointments/:id/cancel', async (req, res) => {
  try {
    const { clientId, tenantId } = req.user!;
    const id = req.params.id as string;
    if (!clientId) return res.status(401).json({ error: 'Authentication required' });

    const appointment = await prisma.appointment.findFirst({ where: { id, tenantId }, include: appointmentInclude });
    if (!appointment) return res.status(404).json({ error: 'Cita no encontrada' });
    if (appointment.clientId !== clientId) {
      return res.status(403).json({ error: 'No tienes permiso para cancelar esta cita' });
    }
    if (appointment.status === 'CANCELLED') return res.status(400).json({ error: 'Esta cita ya ha sido cancelada' });
    if (appointment.status === 'COMPLETED' || appointment.status === 'NO_SHOW') {
      return res.status(400).json({ error: 'No puedes cancelar una cita que ya ocurrió' });
    }

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
    const windowHours = settings?.cancelWindowHrs ?? 12;
    if (windowHours > 0 && appointment.startsAt.getTime() - Date.now() < windowHours * 3600 * 1000) {
      return res.status(409).json({ error: `Solo puedes cancelar con al menos ${windowHours} horas de antelación. Contacta al salón.` });
    }

    const updated = await cancelBooking({ tenantId, id, by: 'CUSTOMER' });

    try {
      await notificationService.createNotification({
        type: 'SYSTEM',
        recipient: clientId,
        clientId,
        content: `Tu cita para ${updated.serviceName} el ${updated.date.split('T')[0]} a las ${updated.startTime} ha sido cancelada exitosamente.`,
        tenantId,
      });
      await notificationService.createNotification({
        type: 'SYSTEM',
        recipient: 'ADMIN',
        content: `La cita #${updated.id} de ${updated.client?.name ?? 'un cliente'} para ${updated.serviceName} el ${updated.date.split('T')[0]} a las ${updated.startTime} ha sido cancelada por el cliente.`,
        tenantId,
      });
    } catch (notifError) {
      console.error('Error creating cancellation notifications:', notifError);
    }

    res.json({ message: 'Cita cancelada exitosamente', appointment: updated });
  } catch (error) {
    const handled = toBookingHttpErrorOrThrow(error);
    return res.status(handled.status).json({ error: handled.message });
  }
});

// GET /api/portal/available-slots?date=YYYY-MM-DD&serviceId=...&professionalId=...
// Devuelve las horas de inicio libres (["10:00", "10:30", ...]).
router.get('/available-slots', async (req, res) => {
  try {
    const { date, serviceId, professionalId } = req.query as Record<string, string | undefined>;
    if (!date || !isValidDateString(date)) {
      return res.status(400).json({ error: 'Fecha requerida (formato YYYY-MM-DD)' });
    }
    if (!serviceId) {
      return res.status(400).json({ error: 'Selecciona un servicio para ver los horarios' });
    }
    const result = await runInTransaction((tx) =>
      computeSlots(tx, {
        tenantId: req.user!.tenantId,
        dateStr: date,
        serviceId,
        professionalId: professionalId || 'any',
        forPublic: true,
        enforceWindow: true,
      })
    );
    res.json(result.slots.map((s) => s.startTime));
  } catch (error) {
    const handled = toBookingHttpErrorOrThrow(error);
    return res.status(handled.status).json({ error: handled.message });
  }
});

export default router;
