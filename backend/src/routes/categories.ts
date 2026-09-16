import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Todas las rutas de categorías son exclusivas de ADMIN.
router.use(authenticateToken, requireAdmin);

// Validation schemas
const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  type: z.enum(['PRODUCT', 'TICKET', 'KNOWLEDGE_BASE']),
  color: z.string().optional(),
  icon: z.string().optional(),
  order: z.number().int().default(0),
});

const updateCategorySchema = createCategorySchema.partial();

// GET /api/categories - Get all categories
router.get('/', async (req, res) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { type } = req.query;

    const where = type ? { tenantId, type: type as any } : { tenantId };

    const categories = await prisma.category.findMany({
      where,
      include: {
        _count: {
          select: {
            products: true,
            tickets: true,
            articles: true,
          },
        },
      },
      orderBy: { order: 'asc' },
    });

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/categories/:id - Get a specific category
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const tenantId = (req as any).user.tenantId;

    const category = await prisma.category.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            products: true,
            tickets: true,
            articles: true,
          },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// POST /api/categories - Create a new category
router.post('/', async (req, res) => {
  try {
    const validatedData = createCategorySchema.parse(req.body);
    const tenantId = (req as any).user.tenantId;

    // Check for duplicate name/type combination
    const existingCategory = await prisma.category.findFirst({
      where: {
        tenantId,
        name: validatedData.name,
        type: validatedData.type,
      },
    });

    if (existingCategory) {
      return res.status(400).json({
        error: `A ${validatedData.type.toLowerCase()} category with this name already exists`,
      });
    }

    const category = await prisma.category.create({
      data: { ...validatedData, tenantId },
      include: {
        _count: {
          select: {
            products: true,
            tickets: true,
            articles: true,
          },
        },
      },
    });

    res.status(201).json(category);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }

    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/categories/:id - Update a category
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const validatedData = updateCategorySchema.parse(req.body);
    const tenantId = (req as any).user.tenantId;

    // Verify category exists
    const existingCategory = await prisma.category.findFirst({
      where: { id, tenantId },
    });

    if (!existingCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check for duplicate name/type combination (excluding current category)
    if (validatedData.name && validatedData.type) {
      const duplicateCategory = await prisma.category.findFirst({
        where: {
          tenantId,
          name: validatedData.name,
          type: validatedData.type,
          id: { not: id },
        },
      });

      if (duplicateCategory) {
        return res.status(400).json({
          error: `A ${validatedData.type.toLowerCase()} category with this name already exists`,
        });
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: validatedData,
      include: {
        _count: {
          select: {
            products: true,
            tickets: true,
            articles: true,
          },
        },
      },
    });

    res.json(category);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }

    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/categories/:id - Delete a category
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const tenantId = (req as any).user.tenantId;

    // Verify category exists
    const category = await prisma.category.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            products: true,
            tickets: true,
            articles: true,
          },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if category has associated items
    const totalItems = category._count.products + category._count.tickets + category._count.articles;

    if (totalItems > 0) {
      return res.status(400).json({
        error: 'Cannot delete category with associated items. Move or delete all items first.',
        details: {
          products: category._count.products,
          tickets: category._count.tickets,
          articles: category._count.articles,
        },
      });
    }

    await prisma.category.delete({
      where: { id },
    });

    res.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return res.status(409).json({
        error: 'No se puede eliminar este registro porque tiene datos asociados en el sistema (ej. facturas, proyectos o suscripciones).',
      });
    }
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;