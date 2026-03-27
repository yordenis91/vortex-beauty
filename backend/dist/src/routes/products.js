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
const createProductSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    description: zod_1.z.string().optional(),
    type: zod_1.z.enum(['SAAS', 'WEB_DEVELOPMENT', 'SUPPORT', 'MAINTENANCE', 'CUSTOM_DEVELOPMENT', 'CONSULTING']),
    price: zod_1.z.number().min(0, 'Price must be positive'),
    currency: zod_1.z.string().default('USD'),
    billingCycle: zod_1.z.enum(['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'YEARLY']),
    categoryId: zod_1.z.string().uuid('Invalid category ID'),
    isPublic: zod_1.z.boolean().default(true),
    stock: zod_1.z.number().int().min(0).optional(),
});
const updateProductSchema = createProductSchema.partial();
// GET /api/products - Get all products for the authenticated user
router.get('/', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const userId = req.userId;
        const products = await prismaClient_1.default.product.findMany({
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
    }
    catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});
// GET /api/products/public - Get public products (for client portal)
router.get('/public', async (req, res) => {
    try {
        const products = await prismaClient_1.default.product.findMany({
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
    }
    catch (error) {
        console.error('Error fetching public products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});
// GET /api/products/:id - Get a specific product
router.get('/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const product = await prismaClient_1.default.product.findFirst({
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
    }
    catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});
// POST /api/products - Create a new product
router.post('/', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const validatedData = createProductSchema.parse(req.body);
        // Verify category exists and belongs to user
        const category = await prismaClient_1.default.category.findFirst({
            where: {
                id: validatedData.categoryId,
                // Note: Categories might need user association in the future
            },
        });
        if (!category) {
            return res.status(400).json({ error: 'Invalid category' });
        }
        const product = await prismaClient_1.default.product.create({
            data: {
                ...validatedData,
                userId,
            },
            include: {
                category: true,
            },
        });
        res.status(201).json(product);
    }
    catch (error) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});
// PUT /api/products/:id - Update a product
router.put('/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const validatedData = updateProductSchema.parse(req.body);
        // Verify product exists and belongs to user
        const existingProduct = await prismaClient_1.default.product.findFirst({
            where: { id, userId },
        });
        if (!existingProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }
        // If category is being updated, verify it exists
        if (validatedData.categoryId) {
            const category = await prismaClient_1.default.category.findFirst({
                where: { id: validatedData.categoryId },
            });
            if (!category) {
                return res.status(400).json({ error: 'Invalid category' });
            }
        }
        const product = await prismaClient_1.default.product.update({
            where: { id },
            data: validatedData,
            include: {
                category: true,
            },
        });
        res.json(product);
    }
    catch (error) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});
// DELETE /api/products/:id - Delete a product
router.delete('/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        // Verify product exists and belongs to user
        const product = await prismaClient_1.default.product.findFirst({
            where: { id, userId },
        });
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        // Check if product has active subscriptions
        const activeSubscriptions = await prismaClient_1.default.subscription.count({
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
        await prismaClient_1.default.product.delete({
            where: { id },
        });
        res.json({ message: 'Product deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});
exports.default = router;
