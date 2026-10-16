import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authenticateToken } from '../middleware/auth';
import { appointmentScope, requirePermission } from '../middleware/can';
import { validateBody } from '../middleware/validate';
import notificationService from '../services/notificationService';
import { createBooking, updateBooking, toBookingHttpErrorOrThrow } from '../services/availability';
import { appointmentInclude, toAppointmentDto } from '../services/availability/dto';
import { computeSlots } from '../services/availability/engine';
import { runInTransaction } from '../lib/db';
import { getTenantTimezone } from '../lib/tenantInfo';
import { addDaysToDateString, dayOfWeekFromDateString, instantToLocal, isValidDateString, localDayRange } from '../lib/time';

const router = Router();

// Todas las rutas son del panel del salón: ADMIN/OWNER ven toda la agenda; un
// STAFF solo la suya (ver appointmentScope).
router.use(authenticateToken, requirePermission('appointments:own'));

const dateOnly = (value: string) => value.split('T')[0];
const timeRegex = /^\d{2}:\d{2}$/;

const createAppointmentSchema = z.object({
  date: z.string().min(10),
  startTime: z.string().regex(timeRegex, 'La hora debe tener formato HH:mm'),
  clientId: z.string().uuid('Invalid client ID'),
  serviceId: z.string().uuid('Invalid service ID'),
  professionalId: z.union([z.string().uuid(), z.literal('any')]).nullable().optional(),
  status: z.enum(['PENDING', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).default('SCHEDULED'),
  notes: z.string().optional(),
});

const updateAppointmentSchema = createAppointmentSchema.partial();

const listQuerySchema = z.object({
  from: z.string().optional(), // YYYY-MM-DD
  to: z.string().optional(), // YYYY-MM-DD (inclusive)
  professionalId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
});

// GET /api/appointments
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const query = listQuerySchema.parse(req.query);
    const scope = await appointmentScope(req);
    if (scope.none) return res.json([]);

    const timezone = await getTenantTimezone(tenantId);
    const range: { gte?: Date; lt?: Date } = {};
    if (query.from && isValidDateString(query.from)) range.gte = localDayRange(timezone, query.from).start;
    if (query.to && isValidDateString(query.to)) range.lt = localDayRange(timezone, addDaysToDateString(query.to, 1)).start;

    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        ...(Object.keys(range).length ? { startsAt: range } : {}),
        ...(query.status ? { status: query.status } : {}),
        professionalId: scope.professionalId ?? query.professionalId,
      },
      include: appointmentInclude,
      orderBy: { startsAt: 'asc' },
    });

    res.json(appointments.map((a) => toAppointmentDto(a, timezone)));
  } catch (error: any) {
    if (error?.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: error.issues });
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// GET /api/appointments/available-slots?date=YYYY-MM-DD&serviceId=...&professionalId=...
// Huecos reservables desde el panel (sin antelación mínima ni máxima).
router.get('/available-slots', async (req, res) => {
  try {
    const { date, serviceId, professionalId, excludeAppointmentId } = req.query as Record<string, string | undefined>;
    if (!date || !isValidDateString(date) || !serviceId) {
      return res.status(400).json({ error: 'date (YYYY-MM-DD) y serviceId son obligatorios' });
    }
    const result = await runInTransaction((tx) =>
      computeSlots(tx, {
        tenantId: req.user!.tenantId,
        dateStr: date,
        serviceId,
        professionalId: professionalId || 'any',
        excludeAppointmentId,
      })
    );
    res.json(
      result.slots.map((s) => ({ startTime: s.startTime, professionalIds: s.professionalIds }))
    );
  } catch (error) {
    const handled = toBookingHttpErrorOrThrow(error);
    return res.status(handled.status).json({ error: handled.message });
  }
});

// GET /api/appointments/fully-booked-dates - fechas sin ningún hueco libre (próximos 60 días)
router.get('/fully-booked-dates', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const timezone = await getTenantTimezone(tenantId);
    const businessHours = await prisma.businessHour.findMany({
      where: { tenantId, maxAppointments: { gt: 0 } },
    });
    if (businessHours.length === 0) return res.json([]);

    // Solo los días con tope diario configurado pueden llenarse "por cupo".
    const appointments = await prisma.appointment.findMany({
      where: { tenantId, status: { in: ['SCHEDULED', 'PENDING', 'COMPLETED'] } },
      select: { startsAt: true },
    });
    const counts = new Map<string, number>();
    for (const a of appointments) {
      const { dateStr } = instantToLocal(timezone, a.startsAt);
      counts.set(dateStr, (counts.get(dateStr) ?? 0) + 1);
    }
    const fullyBooked: string[] = [];
    for (const [dateStr, count] of counts) {
      const dow = dayOfWeekFromDateString(dateStr);
      const bh = businessHours.find((b) => b.dayOfWeek === dow);
      if (bh && count >= bh.maxAppointments) fullyBooked.push(dateStr);
    }
    res.json(fullyBooked);
  } catch (error) {
    console.error('Error fetching fully booked dates:', error);
    res.status(500).json({ error: 'Failed to fetch fully booked dates' });
  }
});

// GET /api/appointments/:id
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const scope = await appointmentScope(req);
    if (scope.none) return res.status(404).json({ error: 'Appointment not found' });

    const appointment = await prisma.appointment.findFirst({
      where: { id: req.params.id as string, tenantId, ...(scope.professionalId ? { professionalId: scope.professionalId } : {}) },
      include: appointmentInclude,
    });
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

    res.json(toAppointmentDto(appointment, await getTenantTimezone(tenantId)));
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// POST /api/appointments
router.post('/', validateBody(createAppointmentSchema), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = req.body as z.infer<typeof createAppointmentSchema>;
    const scope = await appointmentScope(req);
    if (scope.none) return res.status(403).json({ error: 'No tienes un perfil de profesional asociado' });

    const appointment = await createBooking({
      tenantId,
      serviceId: data.serviceId,
      clientId: data.clientId,
      dateStr: dateOnly(data.date),
      startTime: data.startTime,
      // Un STAFF solo agenda en su propio calendario.
      professionalId: scope.professionalId ?? data.professionalId ?? 'any',
      notes: data.notes,
      status: data.status === 'PENDING' ? 'PENDING' : 'SCHEDULED',
      source: 'ADMIN',
    });

    await notifyBestEffort(tenantId, [
      { recipient: 'ADMIN', content: `Nueva cita agendada (panel): ${appointment.client.name} - ${appointment.serviceName}, ${dateOnly(appointment.date)} ${appointment.startTime}-${appointment.endTime}` },
      { recipient: appointment.clientId, clientId: appointment.clientId, content: `Tu cita para ${appointment.serviceName} ha sido agendada para el ${dateOnly(appointment.date)} a las ${appointment.startTime}.` },
    ]);

    res.status(201).json(appointment);
  } catch (error) {
    const handled = toBookingHttpErrorOrThrow(error);
    return res.status(handled.status).json({ error: handled.message });
  }
});

// PUT /api/appointments/:id
router.put('/:id', validateBody(updateAppointmentSchema), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = req.params.id as string;
    const data = req.body as z.infer<typeof updateAppointmentSchema>;
    const scope = await appointmentScope(req);
    if (scope.none) return res.status(404).json({ error: 'Appointment not found' });

    const existing = await prisma.appointment.findFirst({
      where: { id, tenantId, ...(scope.professionalId ? { professionalId: scope.professionalId } : {}) },
      select: { id: true, status: true },
    });
    if (!existing) return res.status(404).json({ error: 'Appointment not found' });

    const appointment = await updateBooking({
      tenantId,
      id,
      dateStr: data.date ? dateOnly(data.date) : undefined,
      startTime: data.startTime,
      serviceId: data.serviceId,
      professionalId: scope.professionalId ? undefined : data.professionalId,
      clientId: data.clientId,
      status: data.status,
      notes: data.notes,
    });

    if (data.status === 'CANCELLED' && existing.status !== 'CANCELLED') {
      await notifyBestEffort(tenantId, [
        { recipient: appointment.clientId, clientId: appointment.clientId, content: `Tu cita para ${appointment.serviceName} el ${dateOnly(appointment.date)} a las ${appointment.startTime} ha sido cancelada.` },
        { recipient: 'ADMIN', content: `La cita #${appointment.id} ha sido cancelada desde el panel.` },
      ]);
    }

    res.json(appointment);
  } catch (error) {
    const handled = toBookingHttpErrorOrThrow(error);
    return res.status(handled.status).json({ error: handled.message });
  }
});

// DELETE /api/appointments/:id
router.delete('/:id', requirePermission('appointments:all'), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = req.params.id as string;
    const appointment = await prisma.appointment.findFirst({ where: { id, tenantId } });
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

    await prisma.appointment.delete({ where: { id } });

    const timezone = await getTenantTimezone(tenantId);
    const dto = toAppointmentDto(appointment, timezone);
    await notifyBestEffort(tenantId, [
      { recipient: appointment.clientId, clientId: appointment.clientId, content: `Tu cita programada para el ${dateOnly(dto.date)} a las ${dto.startTime} ha sido eliminada por el salón.` },
    ]);

    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

async function notifyBestEffort(
  tenantId: string,
  items: Array<{ recipient: string; content: string; clientId?: string }>
) {
  try {
    for (const item of items) {
      await notificationService.createNotification({ type: 'SYSTEM', tenantId, ...item });
    }
  } catch (error) {
    console.error('Error creating appointment notifications:', error);
  }
}

export default router;
