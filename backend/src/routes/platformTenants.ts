import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authenticatePlatformAdmin, requireSuperAdmin, PlatformAuthRequest } from '../middleware/platformAuth';
import { logAudit } from '../services/auditLogService';
import { TenantStatus } from '@prisma/client';

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
        { users: { some: { email: { contains: search, mode: 'insensitive' }, role: 'ADMIN' } } },
      ];
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: {
          platformSubscription: { include: { plan: true } },
          users: { where: { role: 'ADMIN' }, take: 1, select: { id: true, email: true, name: true } },
          _count: { select: { clients: true, staff: true } },
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
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error listando tenants:', error);
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
        users: { where: { role: 'ADMIN' }, select: { id: true, email: true, name: true, createdAt: true } },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Salón no encontrado' });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [staffCount, clientCount, userCount, appointmentsThisMonth, lastAppointment] = await Promise.all([
      prisma.staff.count({ where: { tenantId: id } }),
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
      return res.status(400).json({ error: error.errors });
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
      return res.status(400).json({ error: error.errors });
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
      where: { tenantId: id, role: 'ADMIN' },
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
      process.env.JWT_SECRET!,
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
