import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/can';
import { validateBody } from '../middleware/validate';

const router = Router();

router.use(authenticateToken);

const resourceBody = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(80),
  isActive: z.boolean().optional(),
});

// GET /api/resources
router.get('/', requirePermission('appointments:own'), async (req, res) => {
  try {
    const resources = await prisma.resource.findMany({
      where: { tenantId: req.user!.tenantId },
      include: { services: { select: { serviceId: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(resources.map(({ services, ...r }) => ({ ...r, serviceIds: services.map((s) => s.serviceId) })));
  } catch (error) {
    console.error('Error fetching resources:', error);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

// POST /api/resources
router.post('/', requirePermission('catalog:manage'), validateBody(resourceBody), async (req, res) => {
  try {
    const resource = await prisma.resource.create({ data: { ...req.body, tenantId: req.user!.tenantId } });
    res.status(201).json(resource);
  } catch (error) {
    console.error('Error creating resource:', error);
    res.status(500).json({ error: 'Failed to create resource' });
  }
});

// PUT /api/resources/:id
router.put('/:id', requirePermission('catalog:manage'), validateBody(resourceBody.partial()), async (req, res) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.resource.findFirst({ where: { id, tenantId: req.user!.tenantId }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Recurso no encontrado' });
    res.json(await prisma.resource.update({ where: { id }, data: req.body }));
  } catch (error) {
    console.error('Error updating resource:', error);
    res.status(500).json({ error: 'Failed to update resource' });
  }
});

// DELETE /api/resources/:id
router.delete('/:id', requirePermission('catalog:manage'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.resource.findFirst({ where: { id, tenantId: req.user!.tenantId }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Recurso no encontrado' });
    await prisma.resource.delete({ where: { id } });
    res.json({ message: 'Recurso eliminado' });
  } catch (error) {
    console.error('Error deleting resource:', error);
    res.status(500).json({ error: 'Failed to delete resource' });
  }
});

export default router;
