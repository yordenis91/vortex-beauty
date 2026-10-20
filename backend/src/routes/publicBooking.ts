import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import prisma, { basePrisma } from '../prismaClient';
import { runInTransaction } from '../lib/db';
import { runWithTenant } from '../lib/tenantContext';
import { phoneKey } from '../lib/phone';
import { addDaysToDateString, isValidDateString } from '../lib/time';
import { validateBody } from '../middleware/validate';
import { captchaSiteKey, verifyCaptcha } from '../services/captcha';
import {
  AvailabilityError,
  cancelBooking,
  computeSlots,
  createBooking,
  toBookingHttpErrorOrThrow,
  updateBooking,
} from '../services/availability';
import { appointmentInclude, toAppointmentDto } from '../services/availability/dto';

/**
 * Reserva pública, sin cuenta: /api/public/booking/:slug/...
 *
 * El cliente elige servicio, profesional, fecha y hora, deja nombre y
 * teléfono/correo, y recibe un enlace secreto para cancelar o reprogramar. El
 * salón se resuelve por el slug de la URL y el resto corre en su contexto.
 */
const router = Router({ mergeParams: true });

const readLimiter = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.PUBLIC_READ_LIMIT) || 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas consultas. Inténtalo de nuevo en un minuto.' },
});
const writeLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: Number(process.env.PUBLIC_WRITE_LIMIT) || 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Inténtalo de nuevo en unos minutos.' },
});
router.use(readLimiter);

declare module 'express-serve-static-core' {
  interface Request {
    publicTenant?: { id: string; slug: string; name: string; timezone: string; currency: string };
  }
}

// Resuelve el salón por slug y ejecuta el resto de la petición en su contexto.
async function loadTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = String(req.params.slug ?? '').toLowerCase();
    const tenant = await basePrisma.tenant.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, timezone: true, currency: true, status: true },
    });
    if (!tenant || tenant.status === 'SUSPENDED') {
      return res.status(404).json({ error: 'Salón no encontrado' });
    }
    req.publicTenant = tenant;
    runWithTenant(tenant.id, () => next());
  } catch (error) {
    next(error);
  }
}

async function requireBookingEnabled(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.publicTenant!.id }, select: { bookingEnabled: true } });
    if (settings && !settings.bookingEnabled) {
      return res.status(403).json({ error: 'Este salón no acepta reservas en línea por ahora.' });
    }
    next();
  } catch (error) {
    next(error);
  }
}

router.use('/:slug', loadTenant);

// ---------- Catálogo ----------

// GET /api/public/booking/:slug/logo — el logo como imagen, para los correos (no admiten data URLs).
router.get('/:slug/logo', async (req, res) => {
  try {
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.publicTenant!.id }, select: { logoUrl: true } });
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(settings?.logoUrl ?? '');
    if (!match) return res.status(404).json({ error: 'Sin logo' });
    res.set({ 'Content-Type': match[1], 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'cross-origin' });
    res.send(Buffer.from(match[2], 'base64'));
  } catch (error) {
    console.error('Error sirviendo el logo:', error);
    res.status(500).json({ error: 'Failed to load logo' });
  }
});

// GET /api/public/booking/:slug
router.get('/:slug', async (req, res) => {
  try {
    const tenant = req.publicTenant!;
    const [settings, services, professionals] = await Promise.all([
      prisma.tenantSettings.findUnique({ where: { tenantId: tenant.id } }),
      prisma.service.findMany({
        where: { tenantId: tenant.id, status: 'ACTIVE', isPublic: true, onlineBookable: true },
        include: { category: { select: { id: true, name: true } } },
        orderBy: [{ category: { order: 'asc' } }, { name: 'asc' }],
      }),
      prisma.professional.findMany({
        where: { tenantId: tenant.id, isActive: true, acceptsOnlineBookings: true },
        include: { services: { select: { serviceId: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({
      name: tenant.name,
      slug: tenant.slug,
      timezone: tenant.timezone,
      currency: tenant.currency,
      bookingEnabled: settings?.bookingEnabled ?? true,
      vertical: settings?.vertical ?? 'GENERIC',
      labels: settings?.labels ?? {},
      logoUrl: settings?.logoUrl ?? null,
      brandColor: settings?.brandColor ?? null,
      minNoticeHours: settings?.minNoticeHours ?? 2,
      maxAdvanceDays: settings?.maxAdvanceDays ?? 60,
      cancelWindowHrs: settings?.cancelWindowHrs ?? 12,
      captchaSiteKey: captchaSiteKey(),
      services: services
        // Solo servicios que alguien puede realizar
        .filter((s) => professionals.some((p) => p.services.some((ps) => ps.serviceId === s.id)))
        .map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          price: s.price,
          currency: s.currency,
          durationMinutes: s.durationMinutes,
          category: s.category,
        })),
      professionals: professionals.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        serviceIds: p.services.map((ps) => ps.serviceId),
      })),
    });
  } catch (error) {
    console.error('Error cargando catálogo público:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ---------- Disponibilidad ----------

const availabilityQuery = z.object({
  serviceId: z.string().uuid(),
  date: z.string().refine(isValidDateString, 'Fecha inválida'),
  professionalId: z.union([z.string().uuid(), z.literal('any')]).optional(),
});

// GET /api/public/booking/:slug/availability?serviceId&date&professionalId
router.get('/:slug/availability', requireBookingEnabled, async (req, res) => {
  try {
    const q = availabilityQuery.parse(req.query);
    const result = await runInTransaction((tx) =>
      computeSlots(tx, {
        tenantId: req.publicTenant!.id,
        dateStr: q.date,
        serviceId: q.serviceId,
        professionalId: q.professionalId ?? 'any',
        forPublic: true,
        enforceWindow: true,
      })
    );
    res.json({
      slots: result.slots.map((s) => ({ startTime: s.startTime, professionalIds: s.professionalIds })),
      reason: result.reason,
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') return res.status(400).json({ error: 'Parámetros inválidos', details: error.issues });
    const handled = toBookingHttpErrorOrThrow(error);
    return res.status(handled.status).json({ error: handled.message });
  }
});

const calendarQuery = z.object({
  serviceId: z.string().uuid(),
  from: z.string().refine(isValidDateString),
  to: z.string().refine(isValidDateString),
  professionalId: z.union([z.string().uuid(), z.literal('any')]).optional(),
});

// GET /api/public/booking/:slug/calendar?serviceId&from&to  → días con algún hueco
router.get('/:slug/calendar', requireBookingEnabled, async (req, res) => {
  try {
    const q = calendarQuery.parse(req.query);
    const days: string[] = [];
    for (let date = q.from, i = 0; date <= q.to && i < 45; date = addDaysToDateString(date, 1), i++) days.push(date);

    const availableDates: string[] = [];
    await runInTransaction(async (tx) => {
      for (const dateStr of days) {
        try {
          const result = await computeSlots(tx, {
            tenantId: req.publicTenant!.id,
            dateStr,
            serviceId: q.serviceId,
            professionalId: q.professionalId ?? 'any',
            forPublic: true,
            enforceWindow: true,
          });
          if (result.slots.length > 0) availableDates.push(dateStr);
        } catch (error) {
          if (!(error instanceof AvailabilityError)) throw error;
          // Un servicio inválido falla igual todos los días: se corta.
          if (error.status !== 409) throw error;
        }
      }
    });
    res.json({ availableDates });
  } catch (error: any) {
    if (error?.name === 'ZodError') return res.status(400).json({ error: 'Parámetros inválidos', details: error.issues });
    const handled = toBookingHttpErrorOrThrow(error);
    return res.status(handled.status).json({ error: handled.message });
  }
});

// ---------- Reservar ----------

const bookingSchema = z
  .object({
    serviceId: z.string().uuid(),
    professionalId: z.union([z.string().uuid(), z.literal('any')]).optional(),
    date: z.string().refine(isValidDateString, 'Fecha inválida'),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    customer: z.object({
      name: z.string().trim().min(2, 'Escribe tu nombre').max(80),
      phone: z.string().trim().max(40).optional().or(z.literal('')),
      email: z.string().trim().toLowerCase().email().max(120).optional().or(z.literal('')),
    }),
    notes: z.string().trim().max(500).optional(),
    captchaToken: z.string().max(4000).optional(),
    // Campo trampa: las personas no lo ven ni lo rellenan.
    website: z.string().max(0).optional(),
  })
  .refine((b) => !!b.customer.email || !!phoneKey(b.customer.phone), {
    message: 'Indica un teléfono válido o un correo para poder confirmarte la reserva',
    path: ['customer'],
  });

async function findOrCreateClient(tenantId: string, customer: { name: string; phone?: string; email?: string }) {
  const email = customer.email || null;
  const key = phoneKey(customer.phone);

  const existing =
    (email && (await prisma.client.findFirst({ where: { tenantId, email } }))) ||
    (key && (await prisma.client.findFirst({ where: { tenantId, phoneKey: key } }))) ||
    null;

  if (existing) {
    // Completa datos que faltaban, sin pisar los que el salón ya tiene.
    const patch: { email?: string; phone?: string; phoneKey?: string } = {};
    if (!existing.email && email) patch.email = email;
    if (!existing.phoneKey && key) {
      patch.phone = customer.phone;
      patch.phoneKey = key;
    }
    return Object.keys(patch).length ? prisma.client.update({ where: { id: existing.id }, data: patch }) : existing;
  }

  const owner = await prisma.user.findFirst({
    where: { tenantId, role: { in: ['OWNER', 'ADMIN'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!owner) throw new Error('El salón no tiene un administrador');

  return prisma.client.create({
    data: { tenantId, name: customer.name, email, phone: customer.phone || null, phoneKey: key, userId: owner.id },
  });
}

interface PresentableAppointment {
  id: string;
  status: string;
  serviceName: string;
  professional?: { name: string } | null;
  date: string;
  startTime: string;
  endTime: string;
  startsAt: Date;
  priceAmount: unknown;
  currency: string;
  cancelToken: string | null;
}

/**
 * Enlace para que el cliente reciba avisos por el bot del salón. Solo si el salón
 * tiene bot; `linked` indica que este cliente ya lo activó.
 */
async function telegramInfo(tenantId: string, clientId: string, cancelToken: string | null) {
  const [settings, client] = await Promise.all([
    prisma.tenantSettings.findUnique({ where: { tenantId }, select: { telegramBotUsername: true, telegramBotToken: true } }),
    prisma.client.findUnique({ where: { id: clientId }, select: { telegramChatId: true } }),
  ]);
  if (!settings?.telegramBotToken || !settings.telegramBotUsername || !cancelToken) return null;
  return {
    botUsername: settings.telegramBotUsername,
    linked: !!client?.telegramChatId,
    // Un token de cita (secreto, 43 caracteres base64url) cabe en el parámetro de /start (máx. 64).
    deepLink: `https://t.me/${settings.telegramBotUsername}?start=${cancelToken}`,
  };
}

const presentAppointment = (a: PresentableAppointment, slug: string) => ({
  id: a.id,
  status: a.status,
  serviceName: a.serviceName,
  professionalName: a.professional?.name ?? null,
  date: a.date,
  startTime: a.startTime,
  endTime: a.endTime,
  startsAt: a.startsAt,
  priceAmount: a.priceAmount,
  currency: a.currency,
  manageUrl: a.cancelToken ? `/${slug}/mi-cita/${a.cancelToken}` : null,
});

// POST /api/public/booking/:slug/bookings
router.post('/:slug/bookings', writeLimiter, requireBookingEnabled, validateBody(bookingSchema), async (req, res) => {
  try {
    const tenant = req.publicTenant!;
    const body = req.body as z.infer<typeof bookingSchema>;

    if (!(await verifyCaptcha(body.captchaToken, req.ip))) {
      return res.status(400).json({ error: 'No pudimos verificar que eres una persona. Recarga la página e inténtalo de nuevo.' });
    }

    const client = await findOrCreateClient(tenant.id, body.customer);

    // Tope de citas futuras activas por cliente: frena reservas masivas o en broma.
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: tenant.id }, select: { maxActivePerCustomer: true } });
    const limit = settings?.maxActivePerCustomer ?? 3;
    const active = await prisma.appointment.count({
      where: { tenantId: tenant.id, clientId: client.id, status: { in: ['SCHEDULED', 'PENDING'] }, startsAt: { gt: new Date() } },
    });
    if (active >= limit) {
      return res.status(429).json({ error: `Ya tienes ${active} reservas pendientes. Cancela alguna o contacta al salón para reservar más.` });
    }

    const appointment = await createBooking({
      tenantId: tenant.id,
      serviceId: body.serviceId,
      clientId: client.id,
      dateStr: body.date,
      startTime: body.startTime,
      professionalId: body.professionalId ?? 'any',
      notes: body.notes,
      source: 'PUBLIC',
      forPublic: true,
      enforceWindow: true,
    });

    res.status(201).json({
      ...presentAppointment(appointment, tenant.slug),
      telegram: await telegramInfo(tenant.id, client.id, appointment.cancelToken),
    });
  } catch (error) {
    const handled = toBookingHttpErrorOrThrow(error);
    return res.status(handled.status).json({ error: handled.message });
  }
});

// ---------- Gestionar mi cita (enlace secreto) ----------

const MANAGE_GRACE_MS = 7 * 24 * 3600 * 1000;

async function loadByToken(req: Request) {
  const tenant = req.publicTenant!;
  const token = String(req.params.token ?? '');
  if (token.length < 20) return null;
  const appointment = await prisma.appointment.findFirst({
    where: { tenantId: tenant.id, cancelToken: token },
    include: appointmentInclude,
  });
  // Un enlace deja de valer 7 días después de que termina la cita.
  if (!appointment || appointment.endsAt.getTime() + MANAGE_GRACE_MS < Date.now()) return null;
  return appointment;
}

async function manageState(tenantId: string, appointment: { status: string; startsAt: Date }) {
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId }, select: { cancelWindowHrs: true } });
  const windowHrs = settings?.cancelWindowHrs ?? 12;
  const active = appointment.status === 'SCHEDULED' || appointment.status === 'PENDING';
  const hoursLeft = (appointment.startsAt.getTime() - Date.now()) / 3600_000;
  const allowed = active && hoursLeft > 0 && (windowHrs === 0 || hoursLeft >= windowHrs);
  return { cancelWindowHrs: windowHrs, canCancel: allowed, canReschedule: allowed };
}

const presentManage = async (tenantId: string, tenant: { slug: string; name: string }, appointment: Awaited<ReturnType<typeof loadByToken>> & {}, timezone: string) => {
  const dto = toAppointmentDto(appointment, timezone);
  const brand = await prisma.tenantSettings.findUnique({ where: { tenantId }, select: { logoUrl: true, brandColor: true } });
  return {
    salonName: tenant.name,
    logoUrl: brand?.logoUrl ?? null,
    brandColor: brand?.brandColor ?? null,
    appointment: { ...presentAppointment(dto, tenant.slug), serviceId: appointment.serviceId, professionalId: appointment.professionalId },
    telegram: await telegramInfo(tenantId, appointment.clientId, appointment.cancelToken),
    ...(await manageState(tenantId, appointment)),
  };
};

// GET /api/public/booking/:slug/manage/:token
router.get('/:slug/manage/:token', async (req, res) => {
  try {
    const appointment = await loadByToken(req);
    if (!appointment) return res.status(404).json({ error: 'Enlace no válido o vencido' });
    const tenant = req.publicTenant!;
    res.json(await presentManage(tenant.id, tenant, appointment, tenant.timezone));
  } catch (error) {
    console.error('Error cargando cita por enlace:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/public/booking/:slug/manage/:token/availability?date=YYYY-MM-DD
router.get('/:slug/manage/:token/availability', async (req, res) => {
  try {
    const appointment = await loadByToken(req);
    if (!appointment) return res.status(404).json({ error: 'Enlace no válido o vencido' });
    const date = String(req.query.date ?? '');
    if (!isValidDateString(date)) return res.status(400).json({ error: 'Fecha inválida' });

    const result = await runInTransaction((tx) =>
      computeSlots(tx, {
        tenantId: req.publicTenant!.id,
        dateStr: date,
        serviceId: appointment.serviceId,
        // Mismo profesional: es con quien se reservó.
        professionalId: appointment.professionalId ?? 'any',
        excludeAppointmentId: appointment.id,
        enforceWindow: true,
      })
    );
    res.json({ slots: result.slots.map((s) => ({ startTime: s.startTime })), reason: result.reason });
  } catch (error) {
    const handled = toBookingHttpErrorOrThrow(error);
    return res.status(handled.status).json({ error: handled.message });
  }
});

// POST /api/public/booking/:slug/manage/:token/cancel
router.post('/:slug/manage/:token/cancel', writeLimiter, async (req, res) => {
  try {
    const appointment = await loadByToken(req);
    if (!appointment) return res.status(404).json({ error: 'Enlace no válido o vencido' });
    const tenant = req.publicTenant!;

    const state = await manageState(tenant.id, appointment);
    if (!state.canCancel) {
      const active = appointment.status === 'SCHEDULED' || appointment.status === 'PENDING';
      return res.status(409).json({
        error: !active
          ? 'Esta reserva ya no está activa.'
          : `Solo se puede cancelar con al menos ${state.cancelWindowHrs} horas de antelación. Contacta al salón.`,
      });
    }

    await cancelBooking({ tenantId: tenant.id, id: appointment.id, by: 'CUSTOMER' });
    const fresh = await loadByToken(req);
    res.json(await presentManage(tenant.id, tenant, fresh!, tenant.timezone));
  } catch (error) {
    const handled = toBookingHttpErrorOrThrow(error);
    return res.status(handled.status).json({ error: handled.message });
  }
});

const rescheduleSchema = z.object({
  date: z.string().refine(isValidDateString, 'Fecha inválida'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
});

// POST /api/public/booking/:slug/manage/:token/reschedule
router.post('/:slug/manage/:token/reschedule', writeLimiter, validateBody(rescheduleSchema), async (req, res) => {
  try {
    const appointment = await loadByToken(req);
    if (!appointment) return res.status(404).json({ error: 'Enlace no válido o vencido' });
    const tenant = req.publicTenant!;
    const body = req.body as z.infer<typeof rescheduleSchema>;

    const state = await manageState(tenant.id, appointment);
    if (!state.canReschedule) {
      return res.status(409).json({ error: `Solo se puede cambiar con al menos ${state.cancelWindowHrs} horas de antelación. Contacta al salón.` });
    }

    await updateBooking({
      tenantId: tenant.id,
      id: appointment.id,
      dateStr: body.date,
      startTime: body.startTime,
      professionalId: appointment.professionalId,
      enforceWindow: true,
    });
    const fresh = await loadByToken(req);
    res.json(await presentManage(tenant.id, tenant, fresh!, tenant.timezone));
  } catch (error) {
    const handled = toBookingHttpErrorOrThrow(error);
    return res.status(handled.status).json({ error: handled.message });
  }
});

export default router;
