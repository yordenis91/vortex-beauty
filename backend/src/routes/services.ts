import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { runInTransaction } from '../lib/db';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/can';
import { validateBody } from '../middleware/validate';

const router = Router();

router.use(authenticateToken);

const serviceBody = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be positive'),
  // Sin moneda, el servicio usa la del salón.
  currency: z.string().length(3).optional(),
  categoryId: z.string().uuid('Invalid category ID'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).default('ACTIVE'),
  isPublic: z.boolean().default(true),
  onlineBookable: z.boolean().default(true),
  durationMinutes: z.number().int().min(5, 'La duración mínima es 5 minutos').max(24 * 60).default(60),
  bufferBeforeMin: z.number().int().min(0).max(240).default(0),
  bufferAfterMin: z.number().int().min(0).max(240).default(0),
  // Profesionales y recursos que pueden realizarlo. Si se omite professionalIds
  // al crear, lo realizan todos los profesionales activos del salón.
  professionalIds: z.array(z.string().uuid()).optional(),
  resourceIds: z.array(z.string().uuid()).optional(),
});

const createServiceSchema = serviceBody;
const updateServiceSchema = serviceBody.partial();

const serviceInclude = {
  category: true,
  professionals: { select: { professionalId: true } },
  resources: { select: { resourceId: true } },
  _count: { select: { appointments: true } },
} as const;

function present<T extends { professionals: Array<{ professionalId: string }>; resources: Array<{ resourceId: string }> }>(service: T) {
  const { professionals, resources, ...rest } = service;
  return { ...rest, professionalIds: professionals.map((p) => p.professionalId), resourceIds: resources.map((r) => r.resourceId) };
}

async function assertOwnedIds(tx: Prisma.TransactionClient, tenantId: string, professionalIds?: string[], resourceIds?: string[]) {
  if (professionalIds?.length) {
    const count = await tx.professional.count({ where: { id: { in: professionalIds }, tenantId } });
    if (count !== new Set(professionalIds).size) throw new Error('INVALID_PROFESSIONALS');
  }
  if (resourceIds?.length) {
    const count = await tx.resource.count({ where: { id: { in: resourceIds }, tenantId } });
    if (count !== new Set(resourceIds).size) throw new Error('INVALID_RESOURCES');
  }
}

// GET /api/services
router.get('/', requirePermission('appointments:own'), async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      where: { tenantId: req.user!.tenantId },
      include: serviceInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json(services.map(present));
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// GET /api/services/:id
router.get('/:id', requirePermission('appointments:own'), async (req, res) => {
  try {
    const service = await prisma.service.findFirst({
      where: { id: req.params.id as string, tenantId: req.user!.tenantId },
      include: serviceInclude,
    });
    if (!service) return res.status(404).json({ error: 'Service not found' });
    res.json(present(service));
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({ error: 'Failed to fetch service' });
  }
});

// POST /api/services
router.post('/', requirePermission('catalog:manage'), validateBody(createServiceSchema), async (req, res) => {
  try {
    const { tenantId, userId } = req.user!;
    const { professionalIds, resourceIds, ...data } = req.body as z.infer<typeof createServiceSchema>;

    const category = await prisma.category.findFirst({ where: { id: data.categoryId, tenantId }, select: { id: true } });
    if (!category) return res.status(400).json({ error: 'Invalid category' });

    const service = await runInTransaction(async (tx) => {
      await assertOwnedIds(tx, tenantId, professionalIds, resourceIds);
      const proIds =
        professionalIds ?? (await tx.professional.findMany({ where: { tenantId, isActive: true }, select: { id: true } })).map((p) => p.id);

      const currency = data.currency ?? (await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { currency: true } })).currency;
      const created = await tx.service.create({ data: { ...data, currency, tenantId, userId } });
      if (proIds.length) {
        await tx.professionalService.createMany({ data: proIds.map((professionalId) => ({ tenantId, professionalId, serviceId: created.id })) });
      }
      if (resourceIds?.length) {
        await tx.serviceResource.createMany({ data: resourceIds.map((resourceId) => ({ tenantId, resourceId, serviceId: created.id })) });
      }
      return tx.service.findUniqueOrThrow({ where: { id: created.id }, include: serviceInclude });
    });

    res.status(201).json(present(service));
  } catch (error: any) {
    if (error?.message === 'INVALID_PROFESSIONALS') return res.status(400).json({ error: 'Profesional no válido' });
    if (error?.message === 'INVALID_RESOURCES') return res.status(400).json({ error: 'Recurso no válido' });
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// PUT /api/services/:id
router.put('/:id', requirePermission('catalog:manage'), validateBody(updateServiceSchema), async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const id = req.params.id as string;
    const { professionalIds, resourceIds, ...data } = req.body as z.infer<typeof updateServiceSchema>;

    const existing = await prisma.service.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Service not found' });

    if (data.categoryId) {
      const category = await prisma.category.findFirst({ where: { id: data.categoryId, tenantId }, select: { id: true } });
      if (!category) return res.status(400).json({ error: 'Invalid category' });
    }

    const service = await runInTransaction(async (tx) => {
      await assertOwnedIds(tx, tenantId, professionalIds, resourceIds);
      await tx.service.update({ where: { id }, data });
      if (professionalIds) {
        await tx.professionalService.deleteMany({ where: { serviceId: id } });
        await tx.professionalService.createMany({ data: professionalIds.map((professionalId) => ({ tenantId, professionalId, serviceId: id })) });
      }
      if (resourceIds) {
        await tx.serviceResource.deleteMany({ where: { serviceId: id } });
        await tx.serviceResource.createMany({ data: resourceIds.map((resourceId) => ({ tenantId, resourceId, serviceId: id })) });
      }
      return tx.service.findUniqueOrThrow({ where: { id }, include: serviceInclude });
    });

    res.json(present(service));
  } catch (error: any) {
    if (error?.message === 'INVALID_PROFESSIONALS') return res.status(400).json({ error: 'Profesional no válido' });
    if (error?.message === 'INVALID_RESOURCES') return res.status(400).json({ error: 'Recurso no válido' });
    console.error('Error updating service:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// DELETE /api/services/:id
router.delete('/:id', requirePermission('catalog:manage'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.service.findFirst({ where: { id, tenantId: req.user!.tenantId }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Service not found' });

    await prisma.service.delete({ where: { id } });
    res.json({ message: 'Service deleted successfully' });
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return res.status(409).json({
        error: 'No se puede eliminar este servicio porque tiene citas asociadas. Márcalo como inactivo para ocultarlo.',
      });
    }
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

export default router;
