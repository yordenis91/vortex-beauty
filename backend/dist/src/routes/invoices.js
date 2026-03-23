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
    invoiceNumber: zod_1.z.string().min(1),
    issueDate: zod_1.z.string().transform(str => new Date(str)),
    dueDate: zod_1.z.string().transform(str => new Date(str)),
    status: zod_1.z.enum(['PENDING', 'PAID', 'CANCELLED', 'OVERDUE']).optional(),
    subtotal: zod_1.z.number().min(0),
    taxRate: zod_1.z.number().min(0).max(100).optional(),
    totalAmount: zod_1.z.number().min(0),
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
        // Calculate totals
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const taxRate = invoiceData.taxRate || 0;
        const taxAmount = subtotal * (taxRate / 100);
        const totalAmount = subtotal + taxAmount;
        const invoice = await prismaClient_1.default.invoice.create({
            data: {
                ...invoiceData,
                subtotal,
                taxRate,
                totalAmount,
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
    catch (error) { // Le decimos a TS que confíe en nosotros aquí temporalmente
        // Usamos el método interno de Zod para verificar o simplemente asumimos si tiene name
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: error.errors });
        }
        console.error(error);
        return res.status(500).json({ error: "Error interno del servidor" });
    }
});
// PUT /api/invoices/:id - Update invoice
router.put('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { items, ...invoiceData } = invoiceSchema.parse(req.body);
        // Calculate totals
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const taxRate = invoiceData.taxRate || 0;
        const taxAmount = subtotal * (taxRate / 100);
        const totalAmount = subtotal + taxAmount;
        const invoice = await prismaClient_1.default.invoice.update({
            where: { id: req.params.id },
            data: {
                ...invoiceData,
                subtotal,
                taxRate,
                totalAmount,
                items: {
                    deleteMany: {},
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
        res.json(invoice);
    }
    catch (error) { // Le decimos a TS que confíe en nosotros aquí temporalmente
        // Usamos el método interno de Zod para verificar o simplemente asumimos si tiene name
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: error.errors });
        }
        console.error(error);
        return res.status(500).json({ error: "Error interno del servidor" });
    }
});
// DELETE /api/invoices/:id - Delete invoice
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        await prismaClient_1.default.invoice.delete({
            where: { id: req.params.id },
        });
        res.status(204).send();
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
