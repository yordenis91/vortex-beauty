"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const prismaClient_1 = __importDefault(require("../prismaClient"));
const notificationService_1 = __importDefault(require("../services/notificationService"));
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
        // ===== VALIDACIÓN DE HORARIOS COMERCIALES =====
        const appointmentDate = new Date(date);
        const dayOfWeek = appointmentDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const businessHour = await prismaClient_1.default.businessHour.findUnique({
            where: { dayOfWeek },
        });
        if (!businessHour || !businessHour.isOpen) {
            return res.status(400).json({ error: 'El salón está cerrado en ese horario' });
        }
        // Si el admin configuró timeSlots explícitos, el inicio de la cita debe coincidir con uno de ellos.
        if (Array.isArray(businessHour.timeSlots) && businessHour.timeSlots.length > 0) {
            if (!businessHour.timeSlots.includes(startTime)) {
                return res.status(400).json({ error: 'El horario seleccionado no está permitido para este día' });
            }
        }
        // Convert request times to minutes para comparaciones de rango (compatibilidad retro)
        const [reqStartHour, reqStartMin] = startTime.split(':').map(Number);
        const [reqEndHour, reqEndMin] = endTime.split(':').map(Number);
        const [shopStartHour, shopStartMin] = businessHour.startTime.split(':').map(Number);
        const [shopEndHour, shopEndMin] = businessHour.endTime.split(':').map(Number);
        const reqStartMinutes = reqStartHour * 60 + reqStartMin;
        const reqEndMinutes = reqEndHour * 60 + reqEndMin;
        const shopStartMinutes = shopStartHour * 60 + shopStartMin;
        const shopEndMinutes = shopEndHour * 60 + shopEndMin;
        // Verify requested time is within business hours
        if (reqStartMinutes < shopStartMinutes || reqEndMinutes > shopEndMinutes) {
            return res.status(400).json({ error: 'El salón está cerrado en este horario' });
        }
        // ===== VALIDACIÓN DE CUPO MÁXIMO DIARIO =====
        const startOfDay = new Date(`${date.split('T')[0]}T00:00:00.000`);
        const endOfDay = new Date(`${date.split('T')[0]}T23:59:59.999`);
        const currentAppointmentsCount = await prismaClient_1.default.appointment.count({
            where: {
                date: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
                status: 'SCHEDULED',
            },
        });
        if (businessHour.maxAppointments > 0 && currentAppointmentsCount >= businessHour.maxAppointments) {
            return res.status(400).json({ error: 'No hay cupos disponibles para ese día' });
        }
        // ===== VALIDACIÓN DE CONFLICTOS DE HORARIOS =====
        // Convert times to minutes for range comparison
        const newAppointmentStartMinutes = reqStartMinutes;
        const newAppointmentEndMinutes = reqEndMinutes;
        // Check for overlapping appointments on the same day
        const overlappingAppointments = await prismaClient_1.default.appointment.findFirst({
            where: {
                date: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
                status: 'SCHEDULED',
            },
            select: {
                id: true,
                startTime: true,
                endTime: true,
            },
        });
        if (overlappingAppointments) {
            // Convert existing appointment times to minutes
            const [existingStartHour, existingStartMin] = overlappingAppointments.startTime.split(':').map(Number);
            const [existingEndHour, existingEndMin] = overlappingAppointments.endTime.split(':').map(Number);
            const existingStartMinutes = existingStartHour * 60 + existingStartMin;
            const existingEndMinutes = existingEndHour * 60 + existingEndMin;
            // Check if there's an overlap: new appointment starts before existing ends AND new appointment ends after existing starts
            if (newAppointmentStartMinutes < existingEndMinutes && newAppointmentEndMinutes > existingStartMinutes) {
                return res.status(400).json({ error: 'Ya existe una cita en ese horario. Por favor selecciona otro horario.' });
            }
        }
        // Check whether same client already has appointment on that day (opcional)
        const conflictingAppointment = await prismaClient_1.default.appointment.findFirst({
            where: {
                clientId: clientId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
                status: { not: 'CANCELLED' },
            },
        });
        if (conflictingAppointment) {
            return res.status(400).json({ error: 'Ya tienes una cita agendada para ese día' });
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
        // Crear notificación para admin
        try {
            await notificationService_1.default.createNotification({
                type: 'SYSTEM',
                recipient: 'ADMIN',
                content: `Nueva cita agendada: cliente ${appointment.client.name} (${appointment.client.email}) - servicio ${appointment.product.name}, fecha ${new Date(appointment.date).toLocaleDateString('es-ES')} ${appointment.startTime}-${appointment.endTime}`,
            });
            // Notificación para el cliente
            await notificationService_1.default.createNotification({
                type: 'SYSTEM',
                recipient: clientId,
                clientId,
                content: `Tu cita ha sido agendada correctamente: ${appointment.product.name} el ${new Date(appointment.date).toLocaleDateString('es-ES')} a las ${appointment.startTime}.`,
            });
        }
        catch (notifError) {
            console.error('Error creating appointment notifications:', notifError);
        }
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
/**
 * GET /api/portal/available-slots
 * Retorna los slots disponibles para una fecha específica
 * Query params: date (YYYY-MM-DD)
 */
router.get('/available-slots', auth_1.authenticateToken, async (req, res) => {
    try {
        const { date } = req.query;
        if (!date || typeof date !== 'string') {
            return res.status(400).json({ error: 'Fecha requerida (formato YYYY-MM-DD)' });
        }
        // Validar formato de fecha
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            return res.status(400).json({ error: 'Formato de fecha inválido (YYYY-MM-DD)' });
        }
        // Convertir string a Date y obtener día de la semana
        const appointmentDate = new Date(date + 'T00:00:00');
        const dayOfWeek = appointmentDate.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
        // Buscar horario comercial para ese día
        const businessHour = await prismaClient_1.default.businessHour.findUnique({
            where: { dayOfWeek },
        });
        // Si no hay horario comercial o el día está cerrado, retornar array vacío
        if (!businessHour || !businessHour.isOpen) {
            return res.json([]);
        }
        // ===== VALIDACIÓN DE CUPO MÁXIMO DIARIO =====
        // Calcular rango de fecha completo (para DateTime) del día solicitado
        const startOfDay = new Date(`${date}T00:00:00.000`);
        const endOfDay = new Date(`${date}T23:59:59.999`);
        // Contar citas agendadas para ese día
        const currentAppointmentsCount = await prismaClient_1.default.appointment.count({
            where: {
                date: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
                status: 'SCHEDULED',
            },
        });
        // Si se alcanzó el límite máximo de citas para el día, retornar array vacío
        if (businessHour.maxAppointments > 0 && currentAppointmentsCount >= businessHour.maxAppointments) {
            return res.json([]); // No hay más cupos disponibles para este día
        }
        // Los slots de disponibilidad se basan en la lista explícita de timeSlots definidos en el horario comercial
        const availableSlots = Array.isArray(businessHour.timeSlots) ? businessHour.timeSlots : [];
        // Buscar citas agendadas para ese día (rango completo de fecha)
        const scheduledAppointments = await prismaClient_1.default.appointment.findMany({
            where: {
                date: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
                status: 'SCHEDULED',
            },
            select: {
                startTime: true,
                endTime: true,
            },
        });
        // Helper function to convert time string to minutes
        const timeToMinutes = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };
        // Filter available slots by checking for overlaps with existing appointments
        const finalAvailableSlots = availableSlots.filter((slot) => {
            const slotStartMinutes = timeToMinutes(slot);
            // Check if this slot overlaps with any existing appointment
            // Assuming each slot has a fixed duration, we need to check if the slot start time
            // falls within any existing appointment
            const conflict = scheduledAppointments.some(apt => {
                const aptStartMinutes = timeToMinutes(apt.startTime);
                const aptEndMinutes = timeToMinutes(apt.endTime);
                // A slot is unavailable if it falls within an existing appointment
                // We check if the slot start time is before the appointment end time
                // and if the appointment start time is before or at the slot start time
                return slotStartMinutes >= aptStartMinutes && slotStartMinutes < aptEndMinutes;
            });
            return !conflict;
        });
        res.json(finalAvailableSlots);
    }
    catch (error) {
        console.error('Error fetching available slots:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});
