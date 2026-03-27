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
const createCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    description: zod_1.z.string().optional(),
    type: zod_1.z.enum(['PRODUCT', 'TICKET', 'KNOWLEDGE_BASE']),
    color: zod_1.z.string().optional(),
    icon: zod_1.z.string().optional(),
    order: zod_1.z.number().int().default(0),
});
const updateCategorySchema = createCategorySchema.partial();
// GET /api/categories - Get all categories
router.get('/', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { type } = req.query;
        const where = type ? { type: type } : {};
        const categories = await prismaClient_1.default.category.findMany({
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
    }
    catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});
// GET /api/categories/:id - Get a specific category
router.get('/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const category = await prismaClient_1.default.category.findUnique({
            where: { id },
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
    }
    catch (error) {
        console.error('Error fetching category:', error);
        res.status(500).json({ error: 'Failed to fetch category' });
    }
});
// POST /api/categories - Create a new category
router.post('/', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const validatedData = createCategorySchema.parse(req.body);
        // Check for duplicate name/type combination
        const existingCategory = await prismaClient_1.default.category.findFirst({
            where: {
                name: validatedData.name,
                type: validatedData.type,
            },
        });
        if (existingCategory) {
            return res.status(400).json({
                error: `A ${validatedData.type.toLowerCase()} category with this name already exists`,
            });
        }
        const category = await prismaClient_1.default.category.create({
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
        res.status(201).json(category);
    }
    catch (error) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        console.error('Error creating category:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});
// PUT /api/categories/:id - Update a category
router.put('/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const validatedData = updateCategorySchema.parse(req.body);
        // Verify category exists
        const existingCategory = await prismaClient_1.default.category.findUnique({
            where: { id },
        });
        if (!existingCategory) {
            return res.status(404).json({ error: 'Category not found' });
        }
        // Check for duplicate name/type combination (excluding current category)
        if (validatedData.name && validatedData.type) {
            const duplicateCategory = await prismaClient_1.default.category.findFirst({
                where: {
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
        const category = await prismaClient_1.default.category.update({
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
    }
    catch (error) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});
// DELETE /api/categories/:id - Delete a category
router.delete('/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // Verify category exists
        const category = await prismaClient_1.default.category.findUnique({
            where: { id },
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
        await prismaClient_1.default.category.delete({
            where: { id },
        });
        res.json({ message: 'Category deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});
exports.default = router;
