import express from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authenticatePlatformAdmin, requireSuperAdmin, PlatformAuthRequest } from '../middleware/platformAuth';
import { logAudit } from '../services/auditLogService';

const router = express.Router();

router.use(authenticatePlatformAdmin);

const planSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'El slug solo puede tener minúsculas, números y guiones'),
  description: z.string().optional(),
  priceMonthly: z.number().min(0),
  priceYearly: z.number().min(0),
  currency: z.string().default('USD'),
  trialDays: z.number().int().min(0).default(0),
  maxStaff: z.number().int().min(0).nullable().optional(),
  maxAppointmentsPerMonth: z.number().int().min(0).nullable().optional(),
  maxLocations: z.number().int().min(0).nullable().optional(),
  features: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

// GET /api/platform/plans
router.get('/', async (_req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: [{ sortOrder: 'asc' }, { priceMonthly: 'asc' }],
      include: { _count: { select: { tenantSubscriptions: true } } },
    });
    res.json(plans);
  } catch (error) {
    console.error('Error listando planes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/platform/plans
router.post('/', requireSuperAdmin, async (req: PlatformAuthRequest, res) => {
  try {
    const data = planSchema.parse(req.body);

    const plan = await prisma.plan.create({ data });

    await logAudit({
      actorType: 'PLATFORM_ADMIN',
      actorId: req.platformAdmin!.id,
      actorEmail: req.platformAdmin!.email,
      action: 'plan.create',
      targetType: 'Plan',
      targetId: plan.id,
      metadata: { name: plan.name },
      ip: req.ip,
    });

    res.status(201).json(plan);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un plan con ese slug' });
    }
    console.error('Error creando plan:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/platform/plans/:id
router.put('/:id', requireSuperAdmin, async (req: PlatformAuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const data = planSchema.partial().parse(req.body);

    const plan = await prisma.plan.update({ where: { id }, data });

    await logAudit({
      actorType: 'PLATFORM_ADMIN',
      actorId: req.platformAdmin!.id,
      actorEmail: req.platformAdmin!.email,
      action: 'plan.update',
      targetType: 'Plan',
      targetId: id,
      metadata: data,
      ip: req.ip,
    });

    res.json(plan);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un plan con ese slug' });
    }
    console.error('Error actualizando plan:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/platform/plans/:id — solo si ningún tenant está suscrito a él
router.delete('/:id', requireSuperAdmin, async (req: PlatformAuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };

    const subscriberCount = await prisma.tenantSubscription.count({ where: { planId: id } });
    if (subscriberCount > 0) {
      return res.status(409).json({ error: `No se puede eliminar: ${subscriberCount} salón(es) están suscritos a este plan. Desactívalo en su lugar.` });
    }

    await prisma.plan.delete({ where: { id } });

    await logAudit({
      actorType: 'PLATFORM_ADMIN',
      actorId: req.platformAdmin!.id,
      actorEmail: req.platformAdmin!.email,
      action: 'plan.delete',
      targetType: 'Plan',
      targetId: id,
      ip: req.ip,
    });

    res.status(204).send();
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }
    console.error('Error eliminando plan:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
