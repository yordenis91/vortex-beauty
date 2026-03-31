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
const galleryItemSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required'),
    imageUrl: zod_1.z.string().min(1, 'Image URL is required'),
    isActive: zod_1.z.boolean().optional().default(true),
    productId: zod_1.z.string().uuid('Invalid product ID'),
});
// GET /api/gallery - Public active items
router.get('/', async (req, res) => {
    try {
        const galleryItems = await prismaClient_1.default.galleryItem.findMany({
            where: { isActive: true },
            include: { product: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(galleryItems);
    }
    catch (error) {
        console.error('Error fetching active gallery items:', error);
        res.status(500).json({ error: 'Failed to fetch gallery items' });
    }
});
// GET /api/gallery/admin - All items for admins
router.get('/admin', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const galleryItems = await prismaClient_1.default.galleryItem.findMany({
            include: { product: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(galleryItems);
    }
    catch (error) {
        console.error('Error fetching gallery items for admin:', error);
        res.status(500).json({ error: 'Failed to fetch gallery items' });
    }
});
// POST /api/gallery - Create new gallery item (admin)
router.post('/', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const validatedData = galleryItemSchema.parse(req.body);
        const product = await prismaClient_1.default.product.findUnique({ where: { id: validatedData.productId } });
        if (!product) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }
        const createdItem = await prismaClient_1.default.galleryItem.create({
            data: {
                title: validatedData.title,
                imageUrl: validatedData.imageUrl,
                isActive: validatedData.isActive ?? true,
                productId: validatedData.productId,
            },
            include: { product: true },
        });
        res.status(201).json(createdItem);
    }
    catch (error) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        console.error('Error creating gallery item:', error);
        res.status(500).json({ error: 'Failed to create gallery item' });
    }
});
// PUT /api/gallery/:id - Update gallery item (admin)
router.put('/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const validatedData = galleryItemSchema.partial().parse(req.body);
        const existingItem = await prismaClient_1.default.galleryItem.findUnique({ where: { id } });
        if (!existingItem) {
            return res.status(404).json({ error: 'Gallery item not found' });
        }
        if (validatedData.productId) {
            const product = await prismaClient_1.default.product.findUnique({ where: { id: validatedData.productId } });
            if (!product) {
                return res.status(400).json({ error: 'Invalid product ID' });
            }
        }
        const updatedItem = await prismaClient_1.default.galleryItem.update({
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
    }
    catch (error) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        console.error('Error updating gallery item:', error);
        res.status(500).json({ error: 'Failed to update gallery item' });
    }
});
// DELETE /api/gallery/:id - Delete gallery item (admin)
router.delete('/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const existingItem = await prismaClient_1.default.galleryItem.findUnique({ where: { id } });
        if (!existingItem) {
            return res.status(404).json({ error: 'Gallery item not found' });
        }
        await prismaClient_1.default.galleryItem.delete({ where: { id } });
        res.json({ message: 'Gallery item deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting gallery item:', error);
        res.status(500).json({ error: 'Failed to delete gallery item' });
    }
});
exports.default = router;
