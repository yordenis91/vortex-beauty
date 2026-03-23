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
const clientSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    company: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    taxId: zod_1.z.string().optional(),
});
// GET /api/clients - List all clients
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const clients = await prismaClient_1.default.client.findMany({
            where: { userId: req.userId },
            include: { projects: true, invoices: true },
        });
        res.json(clients);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/clients/:id - Get single client
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const client = await prismaClient_1.default.client.findFirst({
            where: { id: req.params.id, userId: req.userId },
            include: { projects: true, invoices: true },
        });
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }
        res.json(client);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/clients - Create new client
router.post('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const data = clientSchema.parse(req.body);
        const client = await prismaClient_1.default.client.create({
            data: { ...data, userId: req.userId },
        });
        res.status(201).json(client);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
// PUT /api/clients/:id - Update client
router.put('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const data = clientSchema.parse(req.body);
        const client = await prismaClient_1.default.client.updateMany({
            where: { id: req.params.id, userId: req.userId },
            data,
        });
        if (client.count === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }
        const updatedClient = await prismaClient_1.default.client.findUnique({
            where: { id: req.params.id },
        });
        res.json(updatedClient);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
// DELETE /api/clients/:id - Delete client
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const client = await prismaClient_1.default.client.deleteMany({
            where: { id: req.params.id, userId: req.userId },
        });
        if (client.count === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }
        res.json({ message: 'Client deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=clients.js.map