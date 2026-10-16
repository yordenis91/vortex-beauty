import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { runInTransaction } from '../lib/db';
import { authenticateToken } from '../middleware/auth';
import { hasPermission, requirePermission } from '../middleware/can';
import { validateBody } from '../middleware/validate';
import { timeToMinutes } from '../lib/time';
import { assertPlanAllows, PlanLimitError } from '../services/planLimits';
import { revokeAllSessions } from '../services/sessions';

const router = Router();

router.use(authenticateToken);

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const scheduleItem = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(timeRegex),
    endTime: z.string().regex(timeRegex),
  })
  .refine((s) => timeToMinutes(s.startTime) < timeToMinutes(s.endTime), 'La hora de fin debe ser posterior a la de inicio');

const professionalBody = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  color: z.string().optional(),
  isActive: z.boolean().optional(),
  acceptsOnlineBookings: z.boolean().optional(),
  // Horario semanal. Si se omite al crear, copia el horario comercial del salón.
  schedule: z.array(scheduleItem).optional(),
  // Servicios que realiza. Si se omite al crear, realiza todos los servicios activos.
  serviceIds: z.array(z.string().uuid()).optional(),
  // Cuenta de acceso (rol STAFF) para que el profesional vea su propia agenda.
  account: z.object({ email: z.string().email(), password: z.string().min(8).max(128) }).optional(),
});

const createProfessionalSchema = professionalBody;
const updateProfessionalSchema = professionalBody.partial();

const professionalInclude = {
  schedules: { orderBy: [{ dayOfWeek: 'asc' as const }, { startTime: 'asc' as const }] },
  services: { select: { serviceId: true } },
  user: { select: { id: true, email: true } },
} satisfies Prisma.ProfessionalInclude;

function present<T extends { services: Array<{ serviceId: string }> }>(professional: T) {
  const { services, ...rest } = professional;
  return { ...rest, serviceIds: services.map((s) => s.serviceId) };
}

async function replaceSchedule(tx: Prisma.TransactionClient, tenantId: string, professionalId: string, schedule: z.infer<typeof scheduleItem>[]) {
  // Tramos solapados del mismo día no tienen sentido.
  const byDay = new Map<number, Array<[number, number]>>();
  for (const s of schedule) {
    const list = byDay.get(s.dayOfWeek) ?? [];
    const range: [number, number] = [timeToMinutes(s.startTime), timeToMinutes(s.endTime)];
    if (list.some(([a, b]) => range[0] < b && range[1] > a)) throw new Error('OVERLAPPING_SCHEDULE');
    list.push(range);
    byDay.set(s.dayOfWeek, list);
  }
  await tx.professionalSchedule.deleteMany({ where: { professionalId } });
  if (schedule.length) {
    await tx.professionalSchedule.createMany({ data: schedule.map((s) => ({ ...s, tenantId, professionalId })) });
  }
}

// GET /api/professionals
router.get('/', requirePermission('appointments:own'), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const where = req.query.active === 'true' ? { tenantId, isActive: true } : { tenantId };
    const professionals = await prisma.professional.findMany({ where, include: professionalInclude, orderBy: { name: 'asc' } });
    res.json(professionals.map(present));
  } catch (error) {
    console.error('Error fetching professionals:', error);
    res.status(500).json({ error: 'Failed to fetch professionals' });
  }
});

// GET /api/professionals/:id
router.get('/:id', requirePermission('appointments:own'), async (req, res) => {
  try {
    const professional = await prisma.professional.findFirst({
      where: { id: req.params.id as string, tenantId: req.user!.tenantId },
      include: professionalInclude,
    });
    if (!professional) return res.status(404).json({ error: 'Profesional no encontrado' });
    res.json(present(professional));
  } catch (error) {
    console.error('Error fetching professional:', error);
    res.status(500).json({ error: 'Failed to fetch professional' });
  }
});

// POST /api/professionals
router.post('/', requirePermission('catalog:manage'), validateBody(createProfessionalSchema), async (req, res) => {
  try {
    const { tenantId } = req.user!;
    const { schedule, serviceIds, account, email, ...data } = req.body as z.infer<typeof createProfessionalSchema>;

    if (account && !hasPermission(req.user!.role, 'team:manage')) {
      return res.status(403).json({ error: 'Solo el dueño puede crear cuentas de acceso' });
    }
    await assertPlanAllows(tenantId, 'professional');

    const professional = await runInTransaction(async (tx) => {
      if (serviceIds?.length) {
        const count = await tx.service.count({ where: { id: { in: serviceIds }, tenantId } });
        if (count !== new Set(serviceIds).size) throw new Error('INVALID_SERVICES');
      }

      let userId: string | undefined;
      if (account) {
        const taken = await tx.user.findFirst({ where: { tenantId, email: account.email }, select: { id: true } });
        if (taken) throw new Error('EMAIL_TAKEN');
        const user = await tx.user.create({
          data: { tenantId, email: account.email, name: data.name, password: await bcrypt.hash(account.password, 10), role: 'STAFF' },
        });
        userId = user.id;
      }

      const created = await tx.professional.create({ data: { ...data, email: email || null, tenantId, userId } });

      const hours =
        schedule ??
        (await tx.businessHour.findMany({ where: { tenantId, isOpen: true } })).map((h) => ({
          dayOfWeek: h.dayOfWeek,
          startTime: h.startTime,
          endTime: h.endTime,
        }));
      await replaceSchedule(tx, tenantId, created.id, hours);

      const ids = serviceIds ?? (await tx.service.findMany({ where: { tenantId, status: 'ACTIVE' }, select: { id: true } })).map((s) => s.id);
      if (ids.length) {
        await tx.professionalService.createMany({ data: ids.map((serviceId) => ({ tenantId, professionalId: created.id, serviceId })) });
      }
      return tx.professional.findUniqueOrThrow({ where: { id: created.id }, include: professionalInclude });
    });

    res.status(201).json(present(professional));
  } catch (error: any) {
    if (error instanceof PlanLimitError) return res.status(402).json({ error: error.message });
    if (error?.message === 'INVALID_SERVICES') return res.status(400).json({ error: 'Servicio no válido' });
    if (error?.message === 'OVERLAPPING_SCHEDULE') return res.status(400).json({ error: 'Hay tramos de horario solapados el mismo día' });
    if (error?.message === 'EMAIL_TAKEN') return res.status(409).json({ error: 'Ya existe un usuario con ese correo en este salón' });
    console.error('Error creating professional:', error);
    res.status(500).json({ error: 'Failed to create professional' });
  }
});

// PUT /api/professionals/:id
router.put('/:id', requirePermission('catalog:manage'), validateBody(updateProfessionalSchema), async (req, res) => {
  try {
    const { tenantId } = req.user!;
    const id = req.params.id as string;
    const { schedule, serviceIds, account, email, ...data } = req.body as z.infer<typeof updateProfessionalSchema>;

    const existing = await prisma.professional.findFirst({ where: { id, tenantId }, select: { id: true, userId: true } });
    if (!existing) return res.status(404).json({ error: 'Profesional no encontrado' });
    if (account && !hasPermission(req.user!.role, 'team:manage')) {
      return res.status(403).json({ error: 'Solo el dueño puede crear cuentas de acceso' });
    }

    const professional = await runInTransaction(async (tx) => {
      if (serviceIds?.length) {
        const count = await tx.service.count({ where: { id: { in: serviceIds }, tenantId } });
        if (count !== new Set(serviceIds).size) throw new Error('INVALID_SERVICES');
      }

      let userId: string | undefined;
      if (account && !existing.userId) {
        const taken = await tx.user.findFirst({ where: { tenantId, email: account.email }, select: { id: true } });
        if (taken) throw new Error('EMAIL_TAKEN');
        const user = await tx.user.create({
          data: { tenantId, email: account.email, name: data.name ?? 'Profesional', password: await bcrypt.hash(account.password, 10), role: 'STAFF' },
        });
        userId = user.id;
      }

      await tx.professional.update({
        where: { id },
        data: { ...data, ...(email !== undefined && { email: email || null }), ...(userId && { userId }) },
      });
      // Desactivar al profesional corta también el acceso de su cuenta.
      if (data.isActive !== undefined && existing.userId) {
        await tx.user.update({ where: { id: existing.userId }, data: { isActive: data.isActive } });
      }
      if (schedule) await replaceSchedule(tx, tenantId, id, schedule);
      if (serviceIds) {
        await tx.professionalService.deleteMany({ where: { professionalId: id } });
        await tx.professionalService.createMany({ data: serviceIds.map((serviceId) => ({ tenantId, professionalId: id, serviceId })) });
      }
      return tx.professional.findUniqueOrThrow({ where: { id }, include: professionalInclude });
    });

    if (data.isActive === false && existing.userId) await revokeAllSessions(existing.userId);
    res.json(present(professional));
  } catch (error: any) {
    if (error?.message === 'INVALID_SERVICES') return res.status(400).json({ error: 'Servicio no válido' });
    if (error?.message === 'OVERLAPPING_SCHEDULE') return res.status(400).json({ error: 'Hay tramos de horario solapados el mismo día' });
    if (error?.message === 'EMAIL_TAKEN') return res.status(409).json({ error: 'Ya existe un usuario con ese correo en este salón' });
    console.error('Error updating professional:', error);
    res.status(500).json({ error: 'Failed to update professional' });
  }
});

// DELETE /api/professionals/:id
router.delete('/:id', requirePermission('catalog:manage'), async (req, res) => {
  try {
    const { tenantId } = req.user!;
    const id = req.params.id as string;
    const existing = await prisma.professional.findFirst({ where: { id, tenantId }, select: { id: true, userId: true } });
    if (!existing) return res.status(404).json({ error: 'Profesional no encontrado' });

    const appointments = await prisma.appointment.count({ where: { professionalId: id, tenantId } });
    if (appointments > 0) {
      return res.status(409).json({ error: 'Este profesional tiene citas registradas. Desactívalo en lugar de eliminarlo.' });
    }

    await runInTransaction(async (tx) => {
      await tx.professional.delete({ where: { id } });
      if (existing.userId) await tx.user.delete({ where: { id: existing.userId } });
    });
    res.json({ message: 'Profesional eliminado' });
  } catch (error) {
    console.error('Error deleting professional:', error);
    res.status(500).json({ error: 'Failed to delete professional' });
  }
});

// ---- Ausencias ----

const timeOffSchema = z
  .object({
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    reason: z.string().max(200).optional(),
    force: z.boolean().optional(),
  })
  .refine((t) => new Date(t.startsAt) < new Date(t.endsAt), 'El fin debe ser posterior al inicio');

router.get('/:id/time-off', requirePermission('appointments:own'), async (req, res) => {
  try {
    const timeOffs = await prisma.timeOff.findMany({
      where: { professionalId: req.params.id as string, tenantId: req.user!.tenantId },
      orderBy: { startsAt: 'asc' },
    });
    res.json(timeOffs);
  } catch (error) {
    console.error('Error fetching time off:', error);
    res.status(500).json({ error: 'Failed to fetch time off' });
  }
});

router.post('/:id/time-off', requirePermission('catalog:manage'), validateBody(timeOffSchema), async (req, res) => {
  try {
    const { tenantId } = req.user!;
    const id = req.params.id as string;
    const { startsAt, endsAt, reason, force } = req.body as z.infer<typeof timeOffSchema>;

    const professional = await prisma.professional.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!professional) return res.status(404).json({ error: 'Profesional no encontrado' });

    const conflicts = await prisma.appointment.count({
      where: {
        tenantId,
        professionalId: id,
        status: { in: ['SCHEDULED', 'PENDING'] },
        startsAt: { lt: new Date(endsAt) },
        endsAt: { gt: new Date(startsAt) },
      },
    });
    if (conflicts > 0 && !force) {
      return res.status(409).json({ error: `Hay ${conflicts} cita(s) en ese periodo. Reprográmalas o confirma para continuar.`, conflicts });
    }

    const timeOff = await prisma.timeOff.create({
      data: { tenantId, professionalId: id, startsAt: new Date(startsAt), endsAt: new Date(endsAt), reason },
    });
    res.status(201).json(timeOff);
  } catch (error) {
    console.error('Error creating time off:', error);
    res.status(500).json({ error: 'Failed to create time off' });
  }
});

router.delete('/time-off/:timeOffId', requirePermission('catalog:manage'), async (req, res) => {
  try {
    const timeOffId = req.params.timeOffId as string;
    const existing = await prisma.timeOff.findFirst({ where: { id: timeOffId, tenantId: req.user!.tenantId }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Ausencia no encontrada' });
    await prisma.timeOff.delete({ where: { id: timeOffId } });
    res.json({ message: 'Ausencia eliminada' });
  } catch (error) {
    console.error('Error deleting time off:', error);
    res.status(500).json({ error: 'Failed to delete time off' });
  }
});

export default router;
