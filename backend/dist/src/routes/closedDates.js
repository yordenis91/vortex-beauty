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
const createClosedDateSchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format YYYY-MM-DD'),
    reason: zod_1.z.string().optional(),
});
// GET /api/closed-dates
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const closedDates = await prismaClient_1.default.closedDate.findMany({
            orderBy: { date: 'asc' },
        });
        res.json(closedDates);
    }
    catch (error) {
        console.error('Error fetching closed dates:', error);
        res.status(500).json({ error: 'Failed to fetch closed dates' });
    }
});
// POST /api/closed-dates
router.post('/', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const parsed = createClosedDateSchema.parse(req.body);
        const existing = await prismaClient_1.default.closedDate.findUnique({ where: { date: parsed.date } });
        if (existing) {
            return res.status(409).json({ error: 'Closed date already exists for this date' });
        }
        const created = await prismaClient_1.default.closedDate.create({
            data: {
                date: parsed.date,
                reason: parsed.reason,
            },
        });
        res.status(201).json(created);
    }
    catch (error) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        console.error('Error creating closed date:', error);
        res.status(500).json({ error: 'Failed to create closed date' });
    }
});
// DELETE /api/closed-dates/:id
router.delete('/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) {
            return res.status(400).json({ error: 'Invalid ID' });
        }
        const existing = await prismaClient_1.default.closedDate.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Closed date not found' });
        }
        await prismaClient_1.default.closedDate.delete({ where: { id } });
        res.json({ message: 'Closed date deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting closed date:', error);
        res.status(500).json({ error: 'Failed to delete closed date' });
    }
});
exports.default = router;
