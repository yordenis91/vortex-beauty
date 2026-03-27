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
const createArticleSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required'),
    content: zod_1.z.string().min(1, 'Content is required'),
    excerpt: zod_1.z.string().optional(),
    categoryId: zod_1.z.string().uuid('Invalid category ID'),
    isPublic: zod_1.z.boolean().default(true),
});
const updateArticleSchema = createArticleSchema.partial().extend({
    status: zod_1.z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});
// GET /api/knowledge-base - Get all knowledge base articles
router.get('/', async (req, res) => {
    try {
        const { category, status, search, public: isPublic } = req.query;
        const where = {};
        if (category)
            where.categoryId = category;
        if (status)
            where.status = status;
        if (isPublic === 'true')
            where.isPublic = true;
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { content: { contains: search, mode: 'insensitive' } },
                { excerpt: { contains: search, mode: 'insensitive' } },
            ];
        }
        const articles = await prismaClient_1.default.knowledgeBase.findMany({
            where,
            include: {
                category: true,
                user: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(articles);
    }
    catch (error) {
        console.error('Error fetching knowledge base articles:', error);
        res.status(500).json({ error: 'Failed to fetch articles' });
    }
});
// GET /api/knowledge-base/public - Get public articles (for client portal)
router.get('/public', async (req, res) => {
    try {
        const { category, search } = req.query;
        const where = {
            status: 'PUBLISHED',
            isPublic: true,
        };
        if (category)
            where.categoryId = category;
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { content: { contains: search, mode: 'insensitive' } },
                { excerpt: { contains: search, mode: 'insensitive' } },
            ];
        }
        const articles = await prismaClient_1.default.knowledgeBase.findMany({
            where,
            include: {
                category: true,
                user: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(articles);
    }
    catch (error) {
        console.error('Error fetching public articles:', error);
        res.status(500).json({ error: 'Failed to fetch articles' });
    }
});
// GET /api/knowledge-base/:id - Get a specific article
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const article = await prismaClient_1.default.knowledgeBase.findUnique({
            where: { id },
            include: {
                category: true,
                user: true,
            },
        });
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        // Increment view count
        await prismaClient_1.default.knowledgeBase.update({
            where: { id },
            data: {
                views: {
                    increment: 1,
                },
            },
        });
        res.json({
            ...article,
            views: article.views + 1, // Return updated view count
        });
    }
    catch (error) {
        console.error('Error fetching article:', error);
        res.status(500).json({ error: 'Failed to fetch article' });
    }
});
// GET /api/knowledge-base/slug/:slug - Get article by slug
router.get('/slug/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const article = await prismaClient_1.default.knowledgeBase.findUnique({
            where: { slug },
            include: {
                category: true,
                user: {
                    select: {
                        name: true,
                    },
                },
            },
        });
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        // Only return published public articles for public access
        if (article.status !== 'PUBLISHED' || !article.isPublic) {
            return res.status(404).json({ error: 'Article not found' });
        }
        // Increment view count
        await prismaClient_1.default.knowledgeBase.update({
            where: { id: article.id },
            data: {
                views: {
                    increment: 1,
                },
            },
        });
        res.json({
            ...article,
            views: article.views + 1,
        });
    }
    catch (error) {
        console.error('Error fetching article by slug:', error);
        res.status(500).json({ error: 'Failed to fetch article' });
    }
});
// POST /api/knowledge-base - Create a new article
router.post('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const validatedData = createArticleSchema.parse(req.body);
        // Verify category exists and is for knowledge base
        const category = await prismaClient_1.default.category.findFirst({
            where: {
                id: validatedData.categoryId,
                type: 'KNOWLEDGE_BASE',
            },
        });
        if (!category) {
            return res.status(400).json({ error: 'Invalid knowledge base category' });
        }
        // Generate slug from title
        const slug = validatedData.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        // Ensure slug is unique
        let uniqueSlug = slug;
        let counter = 1;
        while (await prismaClient_1.default.knowledgeBase.findUnique({ where: { slug: uniqueSlug } })) {
            uniqueSlug = `${slug}-${counter}`;
            counter++;
        }
        const article = await prismaClient_1.default.knowledgeBase.create({
            data: {
                title: validatedData.title,
                content: validatedData.content,
                excerpt: validatedData.excerpt,
                slug: uniqueSlug,
                categoryId: validatedData.categoryId,
                isPublic: validatedData.isPublic,
                userId,
            },
            include: {
                category: true,
                user: true,
            },
        });
        res.status(201).json(article);
    }
    catch (error) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        console.error('Error creating article:', error);
        res.status(500).json({ error: 'Failed to create article' });
    }
});
// PUT /api/knowledge-base/:id - Update an article
router.put('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const validatedData = updateArticleSchema.parse(req.body);
        // Verify article exists and belongs to user
        const existingArticle = await prismaClient_1.default.knowledgeBase.findFirst({
            where: { id, userId },
        });
        if (!existingArticle) {
            return res.status(404).json({ error: 'Article not found' });
        }
        // Verify category if being updated
        if (validatedData.categoryId) {
            const category = await prismaClient_1.default.category.findFirst({
                where: {
                    id: validatedData.categoryId,
                    type: 'KNOWLEDGE_BASE',
                },
            });
            if (!category) {
                return res.status(400).json({ error: 'Invalid knowledge base category' });
            }
        }
        // Update slug if title is being changed
        let updateData = validatedData;
        if (validatedData.title && validatedData.title !== existingArticle.title) {
            const slug = validatedData.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
            let uniqueSlug = slug;
            let counter = 1;
            while (await prismaClient_1.default.knowledgeBase.findFirst({
                where: { slug: uniqueSlug, id: { not: id } },
            })) {
                uniqueSlug = `${slug}-${counter}`;
                counter++;
            }
            updateData = validatedData;
        }
        const article = await prismaClient_1.default.knowledgeBase.update({
            where: { id },
            data: updateData,
            include: {
                category: true,
                user: true,
            },
        });
        res.json(article);
    }
    catch (error) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        console.error('Error updating article:', error);
        res.status(500).json({ error: 'Failed to update article' });
    }
});
// POST /api/knowledge-base/:id/vote - Vote on article helpfulness
router.post('/:id/vote', async (req, res) => {
    try {
        const { id } = req.params;
        const { helpful } = req.body;
        if (typeof helpful !== 'boolean') {
            return res.status(400).json({ error: 'Helpful must be a boolean' });
        }
        const article = await prismaClient_1.default.knowledgeBase.findUnique({
            where: { id },
        });
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        const updateData = helpful
            ? { helpful: { increment: 1 } }
            : { notHelpful: { increment: 1 } };
        const updatedArticle = await prismaClient_1.default.knowledgeBase.update({
            where: { id },
            data: updateData,
        });
        res.json({
            helpful: updatedArticle.helpful,
            notHelpful: updatedArticle.notHelpful,
        });
    }
    catch (error) {
        console.error('Error voting on article:', error);
        res.status(500).json({ error: 'Failed to vote on article' });
    }
});
// DELETE /api/knowledge-base/:id - Delete an article
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        // Verify article exists and belongs to user
        const article = await prismaClient_1.default.knowledgeBase.findFirst({
            where: { id, userId },
        });
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        await prismaClient_1.default.knowledgeBase.delete({
            where: { id },
        });
        res.json({ message: 'Article deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting article:', error);
        res.status(500).json({ error: 'Failed to delete article' });
    }
});
exports.default = router;
