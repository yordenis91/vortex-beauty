import express from 'express';
import { zodResponse } from '../lib/validation';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../prismaClient';
import { config } from '../config';
import { runInTransaction } from '../lib/db';
import { authenticatePlatformAdmin, requireSuperAdmin, PlatformAuthRequest } from '../middleware/platformAuth';
import { invalidateTenantStatus } from '../middleware/auth';
import { applyVerticalTemplate, DEFAULT_HOURS, TEMPLATES } from '../services/verticalTemplates';
import { apiBaseUrl, BotSetupError, connectBot } from '../services/telegramBot';
import { isValidTimezone, timeToMinutes } from '../lib/time';
import { logAudit } from '../services/auditLogService';
import { TenantStatus, Vertical } from '@prisma/client';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Contraseña temporal legible (evita caracteres ambiguos como 0/O, 1/l/I). */
function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(12))
    .map((byte) => alphabet[byte % alphabet.length])
    .join('');
}

const router = express.Router();

router.use(authenticatePlatformAdmin);

const listQuerySchema = z.object({
  status: z.nativeEnum(TenantStatus).optional(),
  planId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/platform/tenants — listado con filtros (estado, plan, búsqueda) y paginación
router.get('/', async (req, res) => {
  try {
    const { status, planId, search, page, pageSize } = listQuerySchema.parse(req.query);

    const where: any = {};
    if (status) where.status = status;
    if (planId) where.platformSubscription = { planId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { users: { some: { email: { contains: search, mode: 'insensitive' }, role: { in: ['OWNER', 'ADMIN'] } } } },
      ];
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: {
          platformSubscription: { include: { plan: true } },
          users: { where: { role: { in: ['OWNER', 'ADMIN'] } }, take: 1, select: { id: true, email: true, name: true } },
          _count: { select: { clients: true, professionals: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.tenant.count({ where }),
    ]);

    res.json({
      data: tenants,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json(zodResponse(error));
    }
    console.error('Error listando tenants:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Identificadores que chocan con rutas de la aplicación (/admin, /r/<slug>, /<slug>/login...).
const RESERVED_SLUGS = new Set(['admin', 'api', 'superadmin', 'login', 'register', 'portal', 'r', 'design-system', 'assets', 'static']);

const slugProblem = async (slug: string): Promise<string | null> => {
  if (!slug) return 'No se pudo generar un identificador válido a partir del nombre';
  if (RESERVED_SLUGS.has(slug)) return `"${slug}" es un nombre reservado por el sistema`;
  if (await prisma.tenant.findUnique({ where: { slug }, select: { id: true } })) return `Ya existe un salón con el identificador "${slug}"`;
  return null;
};

// GET /api/platform/tenants/slug-available?slug=... — para el asistente de alta
router.get('/slug-available', async (req, res) => {
  const slug = slugify(String(req.query.slug ?? ''));
  const problem = await slugProblem(slug);
  res.json({ slug, available: !problem, reason: problem });
});

// GET /api/platform/tenants/templates — servicios, profesional y horario de fábrica de cada vertical (el asistente los precarga)
router.get('/templates', (_req, res) => {
  const templates = Object.fromEntries(
    Object.entries(TEMPLATES).map(([vertical, t]) => [
      vertical,
      {
        services: t.services.map((s) => ({ name: s.name, price: s.price, durationMinutes: s.durationMinutes, category: s.category })),
        professional: t.defaultProfessional,
        resources: t.resources,
        labels: t.labels,
      },
    ])
  );
  res.json({ templates, hours: DEFAULT_HOURS });
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:mm)');

const createTenantSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'El slug solo puede tener minúsculas, números y guiones').optional(),
  planId: z.string(),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
  vertical: z.nativeEnum(Vertical).default('GENERIC'),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  // Alta asistida (todo opcional: sin esto se usa la plantilla del vertical)
  timezone: z.string().refine(isValidTimezone, 'Zona horaria inválida').optional(),
  currency: z.string().length(3).transform((c) => c.toUpperCase()).optional(),
  professionals: z.array(z.string().trim().min(2).max(60)).min(1).max(15).optional(),
  services: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(80),
        price: z.number().min(0).max(1_000_000),
        durationMinutes: z.number().int().min(5).max(600),
        category: z.string().trim().max(60).optional(),
      })
    )
    .min(1)
    .max(40)
    .optional(),
  hours: z
    .array(z.object({ dayOfWeek: z.number().int().min(0).max(6), isOpen: z.boolean(), startTime: hhmm, endTime: hhmm }))
    .length(7)
    .refine((h) => new Set(h.map((d) => d.dayOfWeek)).size === 7, 'Faltan días en el horario')
    .refine((h) => h.some((d) => d.isOpen), 'Abre al menos un día')
    .refine((h) => h.every((d) => !d.isOpen || timeToMinutes(d.startTime) < timeToMinutes(d.endTime)), 'La hora de cierre debe ser posterior a la de apertura')
    .optional(),
  telegramBotToken: z.string().trim().min(10).max(200).optional(),
});

// POST /api/platform/tenants — alta de un salón nuevo con su primer usuario
// ADMIN. Único punto de entrada para crear salones en esta fase (sin
// registro público todavía): genera una contraseña temporal que se devuelve
// UNA sola vez en la respuesta, nunca se guarda en texto plano ni se reenvía
// después — no hay SMTP conectado, así que es responsabilidad de quien crea
// el salón comunicarla por fuera.
router.post('/', requireSuperAdmin, async (req: PlatformAuthRequest, res) => {
  try {
    const data = createTenantSchema.parse(req.body);
    const slug = data.slug ? slugify(data.slug) : slugify(data.name);

    const [problem, plan] = await Promise.all([slugProblem(slug), prisma.plan.findUnique({ where: { id: data.planId } })]);
    if (problem) {
      return res.status(problem.startsWith('Ya existe') ? 409 : 400).json({ error: problem });
    }
    if (!plan) {
      return res.status(400).json({ error: 'Plan no encontrado' });
    }
    if (plan.maxStaff != null && (data.professionals?.length ?? 1) > plan.maxStaff) {
      return res.status(400).json({ error: `El plan ${plan.name} admite hasta ${plan.maxStaff} profesional(es)` });
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const now = new Date();
    const periodEnd = new Date(now);
    if (data.billingCycle === 'YEARLY') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }
    const trialEndsAt = plan.trialDays > 0 ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000) : null;

    const { tenant, adminUser } = await runInTransaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: data.name, slug, ...(data.timezone && { timezone: data.timezone }), ...(data.currency && { currency: data.currency }) },
      });

      const adminUser = await tx.user.create({
        data: {
          email: data.adminEmail,
          name: data.adminName,
          password: hashedPassword,
          role: 'OWNER',
          tenantId: tenant.id,
        },
      });

      await applyVerticalTemplate(tx, {
        tenantId: tenant.id,
        adminUserId: adminUser.id,
        vertical: data.vertical,
        overrides: { services: data.services, professionals: data.professionals, hours: data.hours },
      });

      await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: trialEndsAt ? 'TRIALING' : 'ACTIVE',
          billingCycle: data.billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          trialEndsAt,
          gateway: 'manual',
        },
      });

      return { tenant, adminUser };
    });

    await logAudit({
      actorType: 'PLATFORM_ADMIN',
      actorId: req.platformAdmin!.id,
      actorEmail: req.platformAdmin!.email,
      action: 'tenant.create',
      targetType: 'Tenant',
      targetId: tenant.id,
      tenantId: tenant.id,
      metadata: { name: tenant.name, slug: tenant.slug, planId: plan.id, adminEmail: adminUser.email },
      ip: req.ip,
    });

    // Bot de Telegram del salón (opcional): si falla, el salón ya existe y se avisa para reintentarlo desde Ajustes.
    let telegram: { ok: true; botUsername: string; ownerCode: string } | { ok: false; error: string } | null = null;
    if (data.telegramBotToken) {
      try {
        await connectBot(tenant.id, data.telegramBotToken, apiBaseUrl(req));
        const st = await prisma.tenantSettings.findUniqueOrThrow({ where: { tenantId: tenant.id }, select: { telegramBotUsername: true, telegramOwnerCode: true } });
        telegram = { ok: true, botUsername: st.telegramBotUsername!, ownerCode: st.telegramOwnerCode! };
      } catch (error) {
        telegram = { ok: false, error: error instanceof BotSetupError ? error.message : 'No se pudo conectar el bot' };
      }
    }

    res.status(201).json({
      tenant,
      admin: { id: adminUser.id, email: adminUser.email, name: adminUser.name },
      telegram,
      tempPassword,
      loginUrl: `/${tenant.slug}/login`,
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json(zodResponse(error));
    }
    console.error('Error creando salón:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/platform/tenants/:id — detalle: info, admin, suscripción, uso
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params as { id: string };

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        platformSubscription: { include: { plan: true } },
        users: { where: { role: { in: ['OWNER', 'ADMIN'] } }, select: { id: true, email: true, name: true, createdAt: true } },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Salón no encontrado' });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [staffCount, clientCount, userCount, appointmentsThisMonth, lastAppointment] = await Promise.all([
      prisma.professional.count({ where: { tenantId: id } }),
      prisma.client.count({ where: { tenantId: id } }),
      prisma.user.count({ where: { tenantId: id } }),
      prisma.appointment.count({ where: { tenantId: id, createdAt: { gte: startOfMonth } } }),
      prisma.appointment.findFirst({ where: { tenantId: id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);

    res.json({
      tenant,
      usage: {
        staffCount,
        clientCount,
        userCount,
        appointmentsThisMonth,
        lastActivityAt: lastAppointment?.createdAt ?? null,
      },
    });
  } catch (error) {
    console.error('Error obteniendo detalle de tenant:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/platform/tenants/:id/activity — historial de auditoría de este salón
router.get('/:id/activity', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const entries = await prisma.auditLog.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json(entries);
  } catch (error) {
    console.error('Error obteniendo actividad del tenant:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const statusUpdateSchema = z.object({
  status: z.nativeEnum(TenantStatus),
});

// PATCH /api/platform/tenants/:id/status — activar / suspender / reactivar
router.patch('/:id/status', requireSuperAdmin, async (req: PlatformAuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const { status } = statusUpdateSchema.parse(req.body);

    const existing = await prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true, status: true } });
    if (!existing) {
      return res.status(404).json({ error: 'Salón no encontrado' });
    }

    const tenant = await prisma.tenant.update({ where: { id }, data: { status } });
    invalidateTenantStatus(id);

    await logAudit({
      actorType: 'PLATFORM_ADMIN',
      actorId: req.platformAdmin!.id,
      actorEmail: req.platformAdmin!.email,
      action: 'tenant.status_change',
      targetType: 'Tenant',
      targetId: id,
      tenantId: id,
      metadata: { from: existing.status, to: status },
      ip: req.ip,
    });

    res.json(tenant);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json(zodResponse(error));
    }
    console.error('Error actualizando estado del tenant:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const deleteSchema = z.object({
  confirmSlug: z.string(),
});

// DELETE /api/platform/tenants/:id — borrado permanente (cascada a todos sus datos)
router.delete('/:id', requireSuperAdmin, async (req: PlatformAuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const { confirmSlug } = deleteSchema.parse(req.body);

    const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true, name: true, slug: true } });
    if (!tenant) {
      return res.status(404).json({ error: 'Salón no encontrado' });
    }

    if (confirmSlug !== tenant.slug) {
      return res.status(400).json({ error: 'La confirmación no coincide con el identificador del salón' });
    }

    await prisma.tenant.delete({ where: { id } });
    invalidateTenantStatus(id);

    await logAudit({
      actorType: 'PLATFORM_ADMIN',
      actorId: req.platformAdmin!.id,
      actorEmail: req.platformAdmin!.email,
      action: 'tenant.delete',
      targetType: 'Tenant',
      targetId: id,
      metadata: { name: tenant.name, slug: tenant.slug },
      ip: req.ip,
    });

    res.status(204).send();
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json(zodResponse(error));
    }
    console.error('Error eliminando tenant:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/platform/tenants/:id/impersonate — login-as para soporte, con
// expiración corta y trazabilidad obligatoria en AuditLog.
router.post('/:id/impersonate', requireSuperAdmin, async (req: PlatformAuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };

    const adminUser = await prisma.user.findFirst({
      where: { tenantId: id, role: { in: ['OWNER', 'ADMIN'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, role: true, clientId: true, tenantId: true },
    });

    if (!adminUser) {
      return res.status(404).json({ error: 'Este salón no tiene un usuario administrador para impersonar' });
    }

    const token = jwt.sign(
      {
        userId: adminUser.id,
        role: adminUser.role,
        clientId: adminUser.clientId,
        tenantId: adminUser.tenantId,
        impersonatedBy: req.platformAdmin!.id,
      },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    await logAudit({
      actorType: 'PLATFORM_ADMIN',
      actorId: req.platformAdmin!.id,
      actorEmail: req.platformAdmin!.email,
      action: 'tenant.impersonate.start',
      targetType: 'Tenant',
      targetId: id,
      tenantId: id,
      metadata: { impersonatedUserId: adminUser.id, impersonatedUserEmail: adminUser.email },
      ip: req.ip,
    });

    res.json({ token, expiresIn: '1h' });
  } catch (error) {
    console.error('Error generando token de impersonación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
