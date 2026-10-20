import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { runInTransaction } from '../lib/db';
import { authenticateToken } from '../middleware/auth';
import { hasPermission, requirePermission } from '../middleware/can';
import { validateBody } from '../middleware/validate';
import { dayOfWeekFromDateString, instantToLocal, timeToMinutes } from '../lib/time';
import { getTenantTimezone } from '../lib/tenantInfo';
import { assertPlanAllows, PlanLimitError } from '../services/planLimits';
import { revokeAllSessions } from '../services/sessions';
import { newLinkCode } from '../services/telegramBot';

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

const quotaSlotItem = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  time: z.string().regex(timeRegex),
});

const professionalBody = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  color: z.string().optional(),
  isActive: z.boolean().optional(),
  acceptsOnlineBookings: z.boolean().optional(),
  // Por hora (según su horario) o por cupos (horas exactas por día de la semana).
  bookingMode: z.enum(['TIMED', 'QUOTA']).optional(),
  quotaSlots: z.array(quotaSlotItem).optional(),
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
  quotaSlots: { orderBy: [{ dayOfWeek: 'asc' as const }, { time: 'asc' as const }], select: { dayOfWeek: true, time: true } },
  services: { select: { serviceId: true } },
  user: { select: { id: true, email: true } },
} satisfies Prisma.ProfessionalInclude;

function present<T extends { services: Array<{ serviceId: string }>; telegramChatId?: string | null; telegramLinkCode?: string | null }>(professional: T) {
  // El enlace de Telegram es privado de cada profesional (ver /me/telegram).
  const { services, telegramChatId: _chat, telegramLinkCode: _code, ...rest } = professional;
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

/**
 * Reemplaza los cupos del profesional. No deja quitar un cupo que tiene una cita
 * futura activa: esa cita quedaría en una hora que ya no existe.
 */
async function replaceQuotaSlots(
  tx: Prisma.TransactionClient,
  tenantId: string,
  professionalId: string,
  quotaSlots: z.infer<typeof quotaSlotItem>[]
) {
  const key = (q: { dayOfWeek: number; time: string }) => `${q.dayOfWeek}|${q.time}`;
  const wanted = new Set(quotaSlots.map(key));
  if (wanted.size !== quotaSlots.length) throw new Error('DUPLICATE_QUOTA');

  const current = await tx.professionalQuotaSlot.findMany({ where: { professionalId } });
  const removed = current.filter((q) => !wanted.has(key(q)));
  if (removed.length) {
    const timezone = await getTenantTimezone(tenantId);
    const upcoming = await tx.appointment.findMany({
      where: { professionalId, tenantId, status: { in: ['SCHEDULED', 'PENDING'] }, startsAt: { gte: new Date() } },
      select: { startsAt: true },
    });
    const removedKeys = new Set(removed.map(key));
    for (const a of upcoming) {
      const local = instantToLocal(timezone, a.startsAt);
      if (removedKeys.has(key({ dayOfWeek: dayOfWeekFromDateString(local.dateStr), time: local.time }))) {
        throw new Error(`QUOTA_IN_USE:${local.dateStr} ${local.time}`);
      }
    }
  }
  await tx.professionalQuotaSlot.deleteMany({ where: { professionalId } });
  if (quotaSlots.length) {
    await tx.professionalQuotaSlot.createMany({ data: quotaSlots.map((q) => ({ ...q, tenantId, professionalId })) });
  }
}

/** Respuesta de error común de cupos; devuelve true si el error era de cupos. */
function sendQuotaError(error: any, res: import('express').Response) {
  if (error?.message === 'DUPLICATE_QUOTA') {
    res.status(400).json({ error: 'Hay cupos repetidos el mismo día' });
    return true;
  }
  if (typeof error?.message === 'string' && error.message.startsWith('QUOTA_IN_USE:')) {
    res.status(409).json({ error: `No puedes quitar el cupo con una cita futura (${error.message.slice('QUOTA_IN_USE:'.length)}). Reprograma o cancela esa cita primero.` });
    return true;
  }
  return false;
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

// GET /api/professionals/me/telegram — estado del enlace de Telegram del profesional que inició sesión.
// Debe ir antes de /:id. Con el bot activo y sin enlazar, devuelve (y crea si falta) su código de un solo uso.
router.get('/me/telegram', requirePermission('appointments:own'), async (req, res) => {
  try {
    const { tenantId, userId } = req.user!;
    const [professional, settings] = await Promise.all([
      prisma.professional.findFirst({ where: { tenantId, userId }, select: { id: true, telegramChatId: true, telegramLinkCode: true } }),
      prisma.tenantSettings.findUnique({ where: { tenantId }, select: { telegramBotToken: true, telegramBotUsername: true } }),
    ]);
    if (!professional) return res.json({ hasProfessional: false, botUsername: null, linked: false, code: null });
    const botUsername = settings?.telegramBotToken ? settings.telegramBotUsername ?? null : null;
    const linked = !!professional.telegramChatId;
    let code: string | null = null;
    if (botUsername && !linked) {
      code = professional.telegramLinkCode ?? newLinkCode();
      if (!professional.telegramLinkCode) await prisma.professional.update({ where: { id: professional.id }, data: { telegramLinkCode: code } });
    }
    res.json({ hasProfessional: true, botUsername, linked, code });
  } catch (error) {
    console.error('Error fetching professional telegram link:', error);
    res.status(500).json({ error: 'Failed to fetch telegram link' });
  }
});

// DELETE /api/professionals/me/telegram — desvincula el chat (y invalida cualquier código pendiente).
router.delete('/me/telegram', requirePermission('appointments:own'), async (req, res) => {
  try {
    const { tenantId, userId } = req.user!;
    await prisma.professional.updateMany({ where: { tenantId, userId }, data: { telegramChatId: null, telegramLinkCode: null } });
    res.json({ message: 'Telegram desvinculado' });
  } catch (error) {
    console.error('Error unlinking professional telegram:', error);
    res.status(500).json({ error: 'Failed to unlink telegram' });
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
    const { schedule, quotaSlots, serviceIds, account, email, ...data } = req.body as z.infer<typeof createProfessionalSchema>;

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
      if (quotaSlots?.length) await replaceQuotaSlots(tx, tenantId, created.id, quotaSlots);

      const ids = serviceIds ?? (await tx.service.findMany({ where: { tenantId, status: 'ACTIVE' }, select: { id: true } })).map((s) => s.id);
      if (ids.length) {
        await tx.professionalService.createMany({ data: ids.map((serviceId) => ({ tenantId, professionalId: created.id, serviceId })) });
      }
      return tx.professional.findUniqueOrThrow({ where: { id: created.id }, include: professionalInclude });
    });

    res.status(201).json(present(professional));
  } catch (error: any) {
    if (error instanceof PlanLimitError) return res.status(402).json({ error: error.message });
    if (sendQuotaError(error, res)) return;
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
    const { schedule, quotaSlots, serviceIds, account, email, ...data } = req.body as z.infer<typeof updateProfessionalSchema>;

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
      if (quotaSlots) await replaceQuotaSlots(tx, tenantId, id, quotaSlots);
      if (serviceIds) {
        await tx.professionalService.deleteMany({ where: { professionalId: id } });
        await tx.professionalService.createMany({ data: serviceIds.map((serviceId) => ({ tenantId, professionalId: id, serviceId })) });
      }
      return tx.professional.findUniqueOrThrow({ where: { id }, include: professionalInclude });
    });

    if (data.isActive === false && existing.userId) await revokeAllSessions(existing.userId);
    res.json(present(professional));
  } catch (error: any) {
    if (sendQuotaError(error, res)) return;
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
