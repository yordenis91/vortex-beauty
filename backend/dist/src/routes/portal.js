"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const prismaClient_1 = __importDefault(require("../prismaClient"));
const router = express_1.default.Router();
/**
 * GET /api/portal/my-invoices
 * Retorna las facturas del cliente autenticado
 * Solo pueden ver facturas donde clientId coincida con su clientId en el token
 */
router.get('/my-invoices', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const clientId = req.user?.clientId;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        // Si el usuario es CLIENT pero no tiene un clientId asignado, retornar array vacío
        if (!clientId) {
            return res.json([]);
        }
        // Obtener facturas del cliente
        const invoices = await prismaClient_1.default.invoice.findMany({
            where: {
                clientId: clientId, // Filtrar por clientId del usuario
            },
            include: {
                client: {
                    select: { id: true, name: true, email: true },
                },
                project: {
                    select: { id: true, name: true },
                },
                items: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(invoices);
    }
    catch (error) {
        console.error('Error fetching client invoices:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});
/**
 * GET /api/portal/my-profile
 * Retorna información del perfil del cliente autenticado
 */
router.get('/my-profile', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const user = await prismaClient_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                imageUrl: true,
                clientId: true,
                client: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        address: true,
                        imageUrl: true,
                    },
                },
            },
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    }
    catch (error) {
        console.error('Error fetching user profile:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});
/**
 * PUT /api/portal/my-profile
 * Actualiza el perfil del cliente autenticado
 */
router.put('/my-profile', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const clientId = req.user?.clientId;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const { name, phone, address, imageUrl } = req.body;
        const result = await prismaClient_1.default.$transaction(async (tx) => {
            // Actualizar User si name o imageUrl
            let updatedUser = null;
            if (name !== undefined || imageUrl !== undefined) {
                updatedUser = await tx.user.update({
                    where: { id: userId },
                    data: {
                        ...(name !== undefined && { name }),
                        ...(imageUrl !== undefined && { imageUrl }),
                    },
                });
            }
            // Actualizar Client si phone o address o imageUrl
            let updatedClient = null;
            if (clientId && (phone !== undefined || address !== undefined || imageUrl !== undefined)) {
                updatedClient = await tx.client.update({
                    where: { id: clientId },
                    data: {
                        ...(phone !== undefined && { phone }),
                        ...(address !== undefined && { address }),
                        ...(imageUrl !== undefined && { imageUrl }),
                    },
                });
            }
            return { updatedUser, updatedClient };
        });
        // Retornar el perfil actualizado
        const user = await prismaClient_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                imageUrl: true,
                clientId: true,
                client: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        address: true,
                        imageUrl: true,
                    },
                },
            },
        });
        res.json(user);
    }
    catch (error) {
        console.error('Error updating user profile:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});
/**
 * GET /api/portal/my-subscriptions
 * Retorna las suscripciones del cliente autenticado
 */
router.get('/my-subscriptions', auth_1.authenticateToken, async (req, res) => {
    try {
        const clientId = req.user?.clientId;
        if (!clientId) {
            return res.json([]);
        }
        const subscriptions = await prismaClient_1.default.subscription.findMany({
            where: {
                clientId: clientId,
            },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        price: true,
                        billingCycle: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(subscriptions);
    }
    catch (error) {
        console.error('Error fetching client subscriptions:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});
/**
 * GET /api/portal/my-appointments
 * Retorna las citas del cliente autenticado
 */
router.get('/my-appointments', auth_1.authenticateToken, async (req, res) => {
    try {
        const clientId = req.user?.clientId;
        if (!clientId) {
            return res.json([]);
        }
        const appointments = await prismaClient_1.default.appointment.findMany({
            where: {
                clientId: clientId,
            },
            include: {
                client: {
                    select: { id: true, name: true, email: true },
                },
                product: {
                    select: { id: true, name: true, price: true },
                },
            },
            orderBy: { date: 'asc' },
        });
        res.json(appointments);
    }
    catch (error) {
        console.error('Error fetching client appointments:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});
/**
 * POST /api/portal/appointments
 * Crea una nueva cita para el cliente autenticado
 */
router.post('/appointments', auth_1.authenticateToken, async (req, res) => {
    try {
        const { productId, date, startTime, endTime, notes } = req.body;
        const clientId = req.user?.clientId;
        const userId = req.user?.userId;
        // Validar que el cliente existe
        if (!clientId) {
            return res.status(400).json({ error: 'Cliente no identificado' });
        }
        // Validar campos requeridos
        if (!productId || !date || !startTime || !endTime) {
            return res.status(400).json({ error: 'Campos requeridos faltantes' });
        }
        // Verificar que el producto existe
        const product = await prismaClient_1.default.product.findUnique({
            where: { id: productId },
        });
        if (!product) {
            return res.status(400).json({ error: 'Servicio no encontrado' });
        }
        // Crear la cita
        const appointment = await prismaClient_1.default.appointment.create({
            data: {
                clientId,
                productId,
                date: new Date(date),
                startTime,
                endTime,
                notes: notes || '',
                status: 'SCHEDULED',
            },
            include: {
                client: {
                    select: { id: true, name: true, email: true },
                },
                product: {
                    select: { id: true, name: true, price: true },
                },
            },
        });
        res.status(201).json(appointment);
    }
    catch (error) {
        console.error('Error creating appointment:', error);
        return res.status(500).json({ error: 'Error al crear la cita' });
    }
});
/**
 * GET /api/portal/products
 * Retorna los productos/servicios disponibles para clientes
 */
router.get('/products', auth_1.authenticateToken, async (req, res) => {
    try {
        const products = await prismaClient_1.default.product.findMany({
            where: {
                isPublic: true,
            },
            include: {
                category: {
                    select: { id: true, name: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(products);
    }
    catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});
exports.default = router;
