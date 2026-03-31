import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

const galleryItemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  imageUrl: z.string().min(1, 'Image URL is required'),
  isActive: z.boolean().optional().default(true),
  productId: z.string().uuid('Invalid product ID'),
});

// GET /api/gallery - Public active items
router.get('/', async (req, res) => {
  try {
    const galleryItems = await prisma.galleryItem.findMany({
      where: { isActive: true },
      include: { product: true },
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
    const galleryItems = await prisma.galleryItem.findMany({
      include: { product: true },
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

    const product = await prisma.product.findUnique({ where: { id: validatedData.productId } });
    if (!product) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const createdItem = await prisma.galleryItem.create({
      data: {
        title: validatedData.title,
        imageUrl: validatedData.imageUrl,
        isActive: validatedData.isActive ?? true,
        productId: validatedData.productId,
      },
      include: { product: true },
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

    const existingItem = await prisma.galleryItem.findUnique({ where: { id } });
    if (!existingItem) {
      return res.status(404).json({ error: 'Gallery item not found' });
    }

    if (validatedData.productId) {
      const product = await prisma.product.findUnique({ where: { id: validatedData.productId } });
      if (!product) {
        return res.status(400).json({ error: 'Invalid product ID' });
      }
    }

    const updatedItem = await prisma.galleryItem.update({
      where: { id },
      data: {
        title: validatedData.title ?? existingItem.title,
        imageUrl: validatedData.imageUrl ?? existingItem.imageUrl,
        isActive: validatedData.isActive ?? existingItem.isActive,
        productId: validatedData.productId ?? existingItem.productId,
      },
      include: { product: true },
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
    const existingItem = await prisma.galleryItem.findUnique({ where: { id } });
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
