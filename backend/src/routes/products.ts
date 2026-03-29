import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Validation schemas
const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  type: z.enum(['SAAS', 'WEB_DEVELOPMENT', 'SUPPORT', 'MAINTENANCE', 'CUSTOM_DEVELOPMENT', 'CONSULTING']),
  price: z.number().min(0, 'Price must be positive'),
  currency: z.string().default('USD'),
  billingCycle: z.enum(['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'YEARLY']),
  categoryId: z.string().uuid('Invalid category ID'),
  isPublic: z.boolean().default(true),
  stock: z.number().int().min(0).optional(),
});

const updateProductSchema = createProductSchema.partial();

// GET /api/products - Get all products for the authenticated user
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = (req as any).userId;

    const products = await prisma.product.findMany({
      where: { userId },
      include: {
        category: true,
        _count: {
          select: {
            subscriptions: true,
            orderItems: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/public - Get public products (for client portal)
router.get('/public', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        isPublic: true,
      },
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(products);
  } catch (error) {
    console.error('Error fetching public products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/:id - Get a specific product
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const userId = (req as any).user.id;

    const product = await prisma.product.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        category: true,
        subscriptions: {
          include: {
            client: true,
          },
        },
        orderItems: {
          include: {
            invoice: true,
          },
        },
        _count: {
          select: {
            subscriptions: true,
            orderItems: true,
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// POST /api/products - Create a new product
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const validatedData = createProductSchema.parse(req.body);

    // Verify category exists and belongs to user
    const category = await prisma.category.findFirst({
      where: {
        id: validatedData.categoryId,
        // Note: Categories might need user association in the future
      },
    });

    if (!category) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const product = await prisma.product.create({
      data: {
        ...validatedData,
        userId,
      },
      include: {
        category: true,
      },
    });

    res.status(201).json(product);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }

    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id - Update a product
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const userId = (req as any).userId;
    const validatedData = updateProductSchema.parse(req.body);

    // Verify product exists and belongs to user
    const existingProduct = await prisma.product.findFirst({
      where: { id, userId },
    });

    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // If category is being updated, verify it exists
    if (validatedData.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: validatedData.categoryId },
      });

      if (!category) {
        return res.status(400).json({ error: 'Invalid category' });
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: validatedData,
      include: {
        category: true,
      },
    });

    res.json(product);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }

    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id - Delete a product
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const userId = (req as any).userId;

    // Verify product exists and belongs to user
    const product = await prisma.product.findFirst({
      where: { id, userId },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if product has active subscriptions
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        productId: id,
        status: 'ACTIVE',
      },
    });

    if (activeSubscriptions > 0) {
      return res.status(400).json({
        error: 'Cannot delete product with active subscriptions. Cancel all subscriptions first.',
      });
    }

    await prisma.product.delete({
      where: { id },
    });

    res.json({ message: 'Product deleted successfully' });
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return res.status(409).json({
        error: 'No se puede eliminar este registro porque tiene datos asociados en el sistema (ej. facturas, proyectos o suscripciones).',
      });
    }
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;