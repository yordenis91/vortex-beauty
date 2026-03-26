import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Validation schemas
const createSubscriptionSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  clientId: z.string().uuid('Invalid client ID'),
  startDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  autoRenew: z.boolean().default(true),
});

const updateSubscriptionSchema = z.object({
  status: z.enum(['ACTIVE', 'PENDING', 'CANCELLED', 'EXPIRED', 'SUSPENDED']).optional(),
  endDate: z.string().datetime().optional(),
  nextBilling: z.string().datetime().optional(),
  notes: z.string().optional(),
  autoRenew: z.boolean().optional(),
});

// GET /api/subscriptions - Get all subscriptions for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { status, clientId, productId } = req.query;

    const where: any = { userId };

    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (productId) where.productId = productId;

    const subscriptions = await prisma.subscription.findMany({
      where,
      include: {
        product: true,
        client: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(subscriptions);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// GET /api/subscriptions/:id - Get a specific subscription
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id as string;
    const userId = (req as any).user.id;

    const subscription = await prisma.subscription.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        product: true,
        client: true,
      },
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json(subscription);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// POST /api/subscriptions - Create a new subscription
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const validatedData = createSubscriptionSchema.parse(req.body);

    // Verify product exists and belongs to user
    const product = await prisma.product.findFirst({
      where: {
        id: validatedData.productId,
        userId,
        status: 'ACTIVE',
      },
    });

    if (!product) {
      return res.status(400).json({ error: 'Invalid or inactive product' });
    }

    // Verify client exists and belongs to user
    const client = await prisma.client.findFirst({
      where: {
        id: validatedData.clientId,
        userId,
      },
    });

    if (!client) {
      return res.status(400).json({ error: 'Invalid client' });
    }

    // Generate subscription number
    const subscriptionCount = await prisma.subscription.count({
      where: { userId },
    });

    const subscriptionNumber = `SUB-${String(subscriptionCount + 1).padStart(6, '0')}`;

    // Calculate next billing date based on product billing cycle
    const startDate = validatedData.startDate ? new Date(validatedData.startDate) : new Date();
    let nextBilling = new Date(startDate);

    switch (product.billingCycle) {
      case 'MONTHLY':
        nextBilling.setMonth(nextBilling.getMonth() + 1);
        break;
      case 'QUARTERLY':
        nextBilling.setMonth(nextBilling.getMonth() + 3);
        break;
      case 'SEMI_ANNUAL':
        nextBilling.setMonth(nextBilling.getMonth() + 6);
        break;
      case 'YEARLY':
        nextBilling.setFullYear(nextBilling.getFullYear() + 1);
        break;
      case 'ONE_TIME':
        nextBilling = new Date(0);
        break;
    }

    const subscription = await prisma.subscription.create({
      data: {
        subscriptionNumber,
        productId: validatedData.productId,
        clientId: validatedData.clientId,
        userId,
        startDate,
        nextBilling,
        notes: validatedData.notes,
        autoRenew: validatedData.autoRenew,
      },
      include: {
        product: true,
        client: true,
      },
    });

    res.status(201).json(subscription);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }

    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// PUT /api/subscriptions/:id - Update a subscription
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id as string;
    const userId = (req as any).user.id;
    const validatedData = updateSubscriptionSchema.parse(req.body);

    // Verify subscription exists and belongs to user
    const existingSubscription = await prisma.subscription.findFirst({
      where: { id, userId },
    });

    if (!existingSubscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const subscription = await prisma.subscription.update({
      where: { id },
      data: validatedData,
      include: {
        product: true,
        client: true,
      },
    });

    res.json(subscription);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }

    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// DELETE /api/subscriptions/:id - Cancel a subscription
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id as string;
    const userId = (req as any).user.id;

    // Verify subscription exists and belongs to user
    const subscription = await prisma.subscription.findFirst({
      where: { id: id as string, userId },
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Cancel the subscription instead of deleting it
    await prisma.subscription.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        endDate: new Date(), // End immediately
      },
    });

    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// POST /api/subscriptions/:id/renew - Renew a subscription
router.post('/:id/renew', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id as string;
    const userId = (req as any).user.id;

    // Verify subscription exists and belongs to user
    const subscription = await prisma.subscription.findFirst({
      where: { id: id as string, userId },
      include: { product: true },
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (subscription.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Only active subscriptions can be renewed' });
    }

    // Calculate new billing date
    let nextBilling = new Date();

    switch ((subscription as any).product.billingCycle) {
      case 'MONTHLY':
        nextBilling.setMonth(nextBilling.getMonth() + 1);
        break;
      case 'QUARTERLY':
        nextBilling.setMonth(nextBilling.getMonth() + 3);
        break;
      case 'SEMI_ANNUAL':
        nextBilling.setMonth(nextBilling.getMonth() + 6);
        break;
      case 'YEARLY':
        nextBilling.setFullYear(nextBilling.getFullYear() + 1);
        break;
      case 'ONE_TIME':
        return res.status(400).json({ error: 'One-time subscriptions cannot be renewed' });
    }

    const updatedSubscription = await prisma.subscription.update({
      where: { id },
      data: {
        nextBilling,
        status: 'ACTIVE', // Ensure it's active
      },
      include: {
        product: true,
        client: true,
      },
    });

    res.json(updatedSubscription);
  } catch (error) {
    console.error('Error renewing subscription:', error);
    res.status(500).json({ error: 'Failed to renew subscription' });
  }
});

export default router;