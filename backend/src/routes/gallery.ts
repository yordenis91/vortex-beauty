import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { imageSchema } from '../lib/images';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

const galleryItemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  imageUrl: imageSchema,
  isActive: z.boolean().optional().default(true),
  serviceId: z.string().uuid('Invalid service ID'),
});

// GET /api/gallery - Active items for the salón del usuario autenticado
router.get('/', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const galleryItems = await prisma.galleryItem.findMany({
      where: { isActive: true, tenantId },
      include: { service: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(galleryItems);
  } catch (error) {
    console.error('Error fetching active gallery items:', error);
    res.status(500).json({ error: 'Failed to fetch gallery items' });
  }
});

// GET /api/gallery/admin - All items for admins
router.get('/admin', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const tenantId = req.user!.tenantId;
    const galleryItems = await prisma.galleryItem.findMany({
      where: { tenantId },
      include: { service: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(galleryItems);
  } catch (error) {
    console.error('Error fetching gallery items for admin:', error);
    res.status(500).json({ error: 'Failed to fetch gallery items' });
  }
});

// POST /api/gallery - Create new gallery item (admin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const validatedData = galleryItemSchema.parse(req.body);
    const tenantId = req.user!.tenantId;

    const service = await prisma.service.findFirst({ where: { id: validatedData.serviceId, tenantId } });
    if (!service) {
      return res.status(400).json({ error: 'Invalid service ID' });
    }

    const createdItem = await prisma.galleryItem.create({
      data: {
        title: validatedData.title,
        imageUrl: validatedData.imageUrl,
        isActive: validatedData.isActive ?? true,
        serviceId: validatedData.serviceId,
        tenantId,
      },
      include: { service: true },
    });

    res.status(201).json(createdItem);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    console.error('Error creating gallery item:', error);
    res.status(500).json({ error: 'Failed to create gallery item' });
  }
});

// PUT /api/gallery/:id - Update gallery item (admin)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const validatedData = galleryItemSchema.partial().parse(req.body);
    const tenantId = req.user!.tenantId;

    const existingItem = await prisma.galleryItem.findFirst({ where: { id, tenantId } });
    if (!existingItem) {
      return res.status(404).json({ error: 'Gallery item not found' });
    }

    if (validatedData.serviceId) {
      const service = await prisma.service.findFirst({ where: { id: validatedData.serviceId, tenantId } });
      if (!service) {
        return res.status(400).json({ error: 'Invalid service ID' });
      }
    }

    const updatedItem = await prisma.galleryItem.update({
      where: { id },
      data: {
        title: validatedData.title ?? existingItem.title,
        imageUrl: validatedData.imageUrl ?? existingItem.imageUrl,
        isActive: validatedData.isActive ?? existingItem.isActive,
        serviceId: validatedData.serviceId ?? existingItem.serviceId,
      },
      include: { service: true },
    });

    res.json(updatedItem);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    console.error('Error updating gallery item:', error);
    res.status(500).json({ error: 'Failed to update gallery item' });
  }
});

// DELETE /api/gallery/:id - Delete gallery item (admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId;
    const existingItem = await prisma.galleryItem.findFirst({ where: { id, tenantId } });
    if (!existingItem) {
      return res.status(404).json({ error: 'Gallery item not found' });
    }

    await prisma.galleryItem.delete({ where: { id } });
    res.json({ message: 'Gallery item deleted successfully' });
  } catch (error) {
    console.error('Error deleting gallery item:', error);
    res.status(500).json({ error: 'Failed to delete gallery item' });
  }
});

export default router;
