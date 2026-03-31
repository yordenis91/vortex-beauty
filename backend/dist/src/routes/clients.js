"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const prismaClient_1 = __importDefault(require("../prismaClient"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const clientSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    email: zod_1.z.string().email(),
    code: zod_1.z.string().optional(),
    displayName: zod_1.z.string().optional(),
    type: zod_1.z.enum(['CUSTOMER', 'SUPPLIER']).optional(),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    zipCode: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
    groupId: zod_1.z.string().optional(),
    ownerId: zod_1.z.string().optional(),
    taxId: zod_1.z.string().optional(),
    imageUrl: zod_1.z.string().optional(),
});
const createClientSchema = clientSchema.extend({
    username: zod_1.z.string().min(1).optional(),
    password: zod_1.z.string().min(6).optional(),
    sendWelcomeEmail: zod_1.z.boolean().optional(),
});
const updateClientSchema = clientSchema.partial();
// GET /api/clients - List all clients
router.get('/', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
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
router.get('/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
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
router.post('/', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const parsed = createClientSchema.parse(req.body);
        const { username, password, sendWelcomeEmail, ...clientData } = parsed;
        const result = await prismaClient_1.default.$transaction(async (tx) => {
            const newClient = await tx.client.create({
                data: {
                    ...clientData,
                    type: clientData.type || 'CUSTOMER',
                    userId: req.userId,
                },
            });
            let newUser = null;
            if (username && password) {
                const hashedPassword = await bcryptjs_1.default.hash(password, 10);
                newUser = await tx.user.create({
                    data: {
                        email: clientData.email,
                        username,
                        password: hashedPassword,
                        name: clientData.displayName || clientData.name,
                        role: 'CLIENT',
                        clientId: newClient.id,
                    },
                });
                if (sendWelcomeEmail) {
                    console.log('Sending welcome email to...', clientData.email);
                }
            }
            return { newClient, newUser };
        });
        res.status(201).json(result.newClient);
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
// PUT /api/clients/:id - Update client
router.put('/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const data = updateClientSchema.parse(req.body);
        const client = await prismaClient_1.default.client.updateMany({
            where: { id: req.params.id, userId: req.userId },
            data: {
                ...data,
                type: data.type || undefined,
            },
        });
        if (client.count === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }
        const updatedClient = await prismaClient_1.default.client.findUnique({
            where: { id: req.params.id },
        });
        res.json(updatedClient);
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
// DELETE /api/clients/:id - Delete client
router.delete('/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        // Verify client exists and belongs to user
        const existingClient = await prismaClient_1.default.client.findFirst({
            where: { id: req.params.id, userId: req.userId },
        });
        if (!existingClient) {
            return res.status(404).json({ error: 'Client not found' });
        }
        await prismaClient_1.default.client.delete({
            where: { id: req.params.id },
        });
        res.json({ message: 'Client deleted successfully' });
    }
    catch (error) { // Le decimos a TS que confíe en nosotros aquí temporalmente
        // Usamos el método interno de Zod para verificar o simplemente asumimos si tiene name
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: error.errors });
        }
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
            return res.status(409).json({
                error: 'No se puede eliminar este registro porque tiene datos asociados en el sistema (ej. facturas, proyectos o suscripciones).',
            });
        }
        console.error(error);
        return res.status(500).json({ error: "Error interno del servidor" });
    }
});
exports.default = router;
