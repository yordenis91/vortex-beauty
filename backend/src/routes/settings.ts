import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authenticateToken } from '../middleware/auth';
import { hasPermission, requirePermission } from '../middleware/can';
import { validateBody } from '../middleware/validate';
import { invalidateTenantTimezone } from '../lib/tenantInfo';
import { isValidTimezone, timeToMinutes } from '../lib/time';
import { Vertical } from '@prisma/client';
import { apiBaseUrl, BotSetupError, connectBot, disconnectBot } from '../services/telegramBot';


const router = Router();

router.use(authenticateToken);

const timeRegex = /^\d{2}:\d{2}$/;

const businessHourSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(timeRegex, 'Start time must be in format HH:mm'),
    endTime: z.string().regex(timeRegex, 'End time must be in format HH:mm'),
    // Horas de inicio explícitas. Si hay alguna, solo se ofrecen esas horas.
    timeSlots: z.array(z.string().regex(timeRegex, 'Time slots must be in format HH:mm')).default([]),
    isOpen: z.boolean().default(true),
    maxAppointments: z.number().int().min(0).default(0),
  })
  .refine((h) => !h.isOpen || timeToMinutes(h.startTime) < timeToMinutes(h.endTime), 'La hora de cierre debe ser posterior a la de apertura');

const DEFAULT_HOURS = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  startTime: '09:00',
  endTime: '18:00',
  timeSlots: [] as string[],
  isOpen: dayOfWeek !== 0,
  maxAppointments: 0,
}));

// GET /api/settings/business-hours — horario comercial (crea el de fábrica si el salón no tiene)
router.get('/business-hours', async (req, res) => {
  try {
    const { tenantId } = req.user!;
    const count = await prisma.businessHour.count({ where: { tenantId } });
    if (count === 0) {
      await prisma.businessHour.createMany({ data: DEFAULT_HOURS.map((h) => ({ ...h, tenantId })), skipDuplicates: true });
    }
    res.json(await prisma.businessHour.findMany({ where: { tenantId }, orderBy: { dayOfWeek: 'asc' } }));
  } catch (error) {
    console.error('Error fetching business hours:', error);
    res.status(500).json({ error: 'Failed to fetch business hours' });
  }
});

// GET /api/settings/business-hours/:dayOfWeek
router.get('/business-hours/:dayOfWeek', async (req, res) => {
  try {
    const day = parseInt(req.params.dayOfWeek as string);
    if (isNaN(day) || day < 0 || day > 6) return res.status(400).json({ error: 'Invalid day of week (0-6)' });

    const businessHour = await prisma.businessHour.findUnique({
      where: { tenantId_dayOfWeek: { tenantId: req.user!.tenantId, dayOfWeek: day } },
    });
    if (!businessHour) return res.status(404).json({ error: 'Business hours not found for this day' });
    res.json(businessHour);
  } catch (error) {
    console.error('Error fetching business hour:', error);
    res.status(500).json({ error: 'Failed to fetch business hour' });
  }
});

// PUT /api/settings/business-hours/:dayOfWeek
router.put('/business-hours/:dayOfWeek', requirePermission('settings:manage'), validateBody(businessHourSchema), async (req, res) => {
  try {
    const day = parseInt(req.params.dayOfWeek as string);
    const data = req.body as z.infer<typeof businessHourSchema>;
    if (isNaN(day) || day < 0 || day > 6) return res.status(400).json({ error: 'Invalid day of week (0-6)' });
    if (data.dayOfWeek !== day) return res.status(400).json({ error: 'Day of week in URL does not match request body' });

    const { tenantId } = req.user!;
    const businessHour = await prisma.businessHour.upsert({
      where: { tenantId_dayOfWeek: { tenantId, dayOfWeek: day } },
      update: data,
      create: { ...data, tenantId },
    });
    res.json(businessHour);
  } catch (error) {
    console.error('Error updating business hour:', error);
    res.status(500).json({ error: 'Failed to update business hour' });
  }
});

// ---- Ajustes de reserva y vocabulario ----

const bookingSettingsSchema = z.object({
  timezone: z.string().refine(isValidTimezone, 'Zona horaria inválida').optional(),
  vertical: z.nativeEnum(Vertical).optional(),
  slotIntervalMin: z.number().int().min(5).max(240).optional(),
  minNoticeHours: z.number().int().min(0).max(24 * 14).optional(),
  maxAdvanceDays: z.number().int().min(1).max(730).optional(),
  cancelWindowHrs: z.number().int().min(0).max(24 * 14).optional(),
  bookingEnabled: z.boolean().optional(),
  maxActivePerCustomer: z.number().int().min(1).max(50).optional(),
  reminderHours: z.array(z.number().int().min(1).max(24 * 14)).max(5).optional(),
  ownerAlerts: z.boolean().optional(),
  // Telegram: el token solo se escribe (nunca se devuelve); '' lo borra.
  telegramBotToken: z.string().max(200).optional(),
  telegramChatId: z.string().max(60).optional(),
  labels: z.record(z.string(), z.string().max(40)).optional(),
});

async function loadBookingSettings(tenantId: string, canManage: boolean) {
  const [settings, tenant] = await Promise.all([
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, slug: true, timezone: true, currency: true } }),
  ]);
  return {
    name: tenant.name,
    slug: tenant.slug,
    currency: tenant.currency,
    timezone: tenant.timezone,
    vertical: settings?.vertical ?? 'GENERIC',
    slotIntervalMin: settings?.slotIntervalMin ?? 30,
    minNoticeHours: settings?.minNoticeHours ?? 2,
    maxAdvanceDays: settings?.maxAdvanceDays ?? 60,
    cancelWindowHrs: settings?.cancelWindowHrs ?? 12,
    bookingEnabled: settings?.bookingEnabled ?? true,
    maxActivePerCustomer: settings?.maxActivePerCustomer ?? 3,
    reminderHours: settings?.reminderHours ?? [24, 2],
    ownerAlerts: settings?.ownerAlerts ?? true,
    telegramConfigured: !!(settings?.telegramBotToken && settings?.telegramChatId),
    telegramChatId: settings?.telegramChatId ?? '',
    // Bot de clientes: el código de enlace del dueño solo lo ven quienes gestionan ajustes.
    telegramBotUsername: settings?.telegramBotUsername ?? null,
    telegramOwnerCode: canManage ? (settings?.telegramOwnerCode ?? null) : null,
    labels: (settings?.labels as Record<string, string> | undefined) ?? {},
  };
}

// GET /api/settings/booking
router.get('/booking', async (req, res) => {
  try {
    res.json(await loadBookingSettings(req.user!.tenantId, hasPermission(req.user!.role, 'settings:manage')));
  } catch (error) {
    console.error('Error fetching booking settings:', error);
    res.status(500).json({ error: 'Failed to fetch booking settings' });
  }
});

// PUT /api/settings/booking
router.put('/booking', requirePermission('settings:manage'), validateBody(bookingSettingsSchema), async (req, res) => {
  try {
    const { tenantId } = req.user!;
    const { timezone, telegramBotToken, telegramChatId, reminderHours, ...rest } = req.body as z.infer<typeof bookingSettingsSchema>;
    const settings = {
      ...rest,
      ...(reminderHours && { reminderHours: [...new Set(reminderHours)].sort((a, b) => b - a) }),
      ...(telegramChatId !== undefined && { telegramChatId: telegramChatId || null }),
    };

    await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: settings,
      create: { tenantId, ...settings },
    });
    if (timezone) {
      await prisma.tenant.update({ where: { id: tenantId }, data: { timezone } });
      invalidateTenantTimezone(tenantId);
    }
    // El token se valida con Telegram y activa el webhook; vacío desconecta el bot.
    if (telegramBotToken !== undefined) {
      if (telegramBotToken) await connectBot(tenantId, telegramBotToken.trim(), apiBaseUrl(req));
      else await disconnectBot(tenantId, (await prisma.tenantSettings.findUnique({ where: { tenantId }, select: { telegramBotToken: true } }))?.telegramBotToken ?? null);
    }
    res.json(await loadBookingSettings(tenantId, true));
  } catch (error) {
    if (error instanceof BotSetupError) return res.status(400).json({ error: error.message });
    console.error('Error updating booking settings:', error);
    res.status(500).json({ error: 'Failed to update booking settings' });
  }
});

export default router;
