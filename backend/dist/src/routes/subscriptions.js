"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prismaClient_1 = __importDefault(require("../prismaClient"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Validation schemas
const createSubscriptionSchema = zod_1.z.object({
    productId: zod_1.z.string().uuid('Invalid product ID'),
    clientId: zod_1.z.string().uuid('Invalid client ID'),
    startDate: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    autoRenew: zod_1.z.boolean().default(true),
});
const updateSubscriptionSchema = zod_1.z.object({
    status: zod_1.z.enum(['ACTIVE', 'PENDING', 'CANCELLED', 'EXPIRED', 'SUSPENDED']).optional(),
    endDate: zod_1.z.string().optional(),
    nextBilling: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    autoRenew: zod_1.z.boolean().optional(),
});
// GET /api/subscriptions - Get all subscriptions for the authenticated user
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { status, clientId, productId } = req.query;
        const where = { userId };
        if (status)
            where.status = status;
        if (clientId)
            where.clientId = clientId;
        if (productId)
            where.productId = productId;
        const subscriptions = await prismaClient_1.default.subscription.findMany({
            where,
            include: {
                product: true,
                client: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(subscriptions);
    }
    catch (error) {
        console.error('Error fetching subscriptions:', error);
        res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
});
// GET /api/subscriptions/:id - Get a specific subscription
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.userId;
        const subscription = await prismaClient_1.default.subscription.findFirst({
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
    }
    catch (error) {
        console.error('Error fetching subscription:', error);
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
});
// POST /api/subscriptions - Create a new subscription
router.post('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const validatedData = createSubscriptionSchema.parse(req.body);
        // Verify product exists and belongs to user
        const product = await prismaClient_1.default.product.findFirst({
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
        const client = await prismaClient_1.default.client.findFirst({
            where: {
                id: validatedData.clientId,
                userId,
            },
        });
        if (!client) {
            return res.status(400).json({ error: 'Invalid client' });
        }
        // Generate subscription number
        const subscriptionCount = await prismaClient_1.default.subscription.count({
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
        const subscription = await prismaClient_1.default.subscription.create({
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
    }
    catch (error) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        console.error('Error creating subscription:', error);
        res.status(500).json({ error: 'Failed to create subscription' });
    }
});
// PUT /api/subscriptions/:id - Update a subscription
router.put('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.userId;
        const validatedData = updateSubscriptionSchema.parse(req.body);
        // Verify subscription exists and belongs to user
        const existingSubscription = await prismaClient_1.default.subscription.findFirst({
            where: { id, userId },
        });
        if (!existingSubscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }
        const subscription = await prismaClient_1.default.subscription.update({
            where: { id },
            data: validatedData,
            include: {
                product: true,
                client: true,
            },
        });
        res.json(subscription);
    }
    catch (error) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        console.error('Error updating subscription:', error);
        res.status(500).json({ error: 'Failed to update subscription' });
    }
});
// DELETE /api/subscriptions/:id - Cancel a subscription
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.userId;
        // Verify subscription exists and belongs to user
        const subscription = await prismaClient_1.default.subscription.findFirst({
            where: { id: id, userId },
        });
        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }
        // Cancel the subscription instead of deleting it
        await prismaClient_1.default.subscription.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                cancelledAt: new Date(),
                endDate: new Date(), // End immediately
            },
        });
        res.json({ message: 'Subscription cancelled successfully' });
    }
    catch (error) {
        console.error('Error cancelling subscription:', error);
        res.status(500).json({ error: 'Failed to cancel subscription' });
    }
});
// POST /api/subscriptions/:id/renew - Renew a subscription
router.post('/:id/renew', auth_1.authenticateToken, async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.userId;
        // Verify subscription exists and belongs to user
        const subscription = await prismaClient_1.default.subscription.findFirst({
            where: { id: id, userId },
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
        switch (subscription.product.billingCycle) {
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
        const updatedSubscription = await prismaClient_1.default.subscription.update({
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
    }
    catch (error) {
        console.error('Error renewing subscription:', error);
        res.status(500).json({ error: 'Failed to renew subscription' });
    }
});
exports.default = router;
