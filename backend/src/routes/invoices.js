"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const prismaClient_1 = __importDefault(require("../prismaClient"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const invoiceSchema = zod_1.z.object({
    number: zod_1.z.string().min(1),
    issueDate: zod_1.z.string().transform(str => new Date(str)),
    dueDate: zod_1.z.string().transform(str => new Date(str)),
    status: zod_1.z.enum(['PENDING', 'PAID', 'CANCELLED', 'OVERDUE']).optional(),
    subtotal: zod_1.z.number().min(0),
    taxRate: zod_1.z.number().min(0).max(100).optional(),
    taxAmount: zod_1.z.number().min(0).optional(),
    total: zod_1.z.number().min(0),
    notes: zod_1.z.string().optional(),
    clientId: zod_1.z.string(),
    projectId: zod_1.z.string().optional(),
    items: zod_1.z.array(zod_1.z.object({
        description: zod_1.z.string().min(1),
        quantity: zod_1.z.number().min(0),
        unitPrice: zod_1.z.number().min(0),
    })),
});
// GET /api/invoices - List all invoices
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const invoices = await prismaClient_1.default.invoice.findMany({
            where: { userId: req.userId },
            include: { client: true, project: true, items: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(invoices);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/invoices - Create new invoice
router.post('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { items, ...invoiceData } = invoiceSchema.parse(req.body);
        const invoice = await prismaClient_1.default.invoice.create({
            data: {
                ...invoiceData,
                userId: req.userId,
                items: {
                    create: items.map(item => ({
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        total: item.quantity * item.unitPrice,
                    })),
                },
            },
            include: { client: true, project: true, items: true },
        });
        res.status(201).json(invoice);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=invoices.js.map