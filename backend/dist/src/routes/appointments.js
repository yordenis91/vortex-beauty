"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const prismaClient_1 = __importDefault(require("../prismaClient"));
const auth_1 = require("../middleware/auth");
const notificationService_1 = __importDefault(require("../services/notificationService"));
const router = (0, express_1.Router)();
// Validation schemas
const createAppointmentSchema = zod_1.z.object({
    date: zod_1.z.string().datetime('Invalid date format'),
    startTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in format HH:mm'),
    endTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/, 'End time must be in format HH:mm'),
    clientId: zod_1.z.string().uuid('Invalid client ID'),
    productId: zod_1.z.string().uuid('Invalid product ID'),
    status: zod_1.z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).default('SCHEDULED'),
    notes: zod_1.z.string().optional(),
});
const updateAppointmentSchema = createAppointmentSchema.partial();
// GET /api/appointments - Get all appointments for the authenticated user
router.get('/', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const appointments = await prismaClient_1.default.appointment.findMany({
            include: {
                client: true,
                product: true,
            },
            orderBy: { date: 'asc' },
        });
        res.json(appointments);
    }
    catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});
// GET /api/appointments/:id - Get a specific appointment
router.get('/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const appointment = await prismaClient_1.default.appointment.findUnique({
            where: { id },
            include: {
                client: true,
                product: true,
            },
        });
        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        res.json(appointment);
    }
    catch (error) {
        console.error('Error fetching appointment:', error);
        res.status(500).json({ error: 'Failed to fetch appointment' });
    }
});
// POST /api/appointments - Create a new appointment
router.post('/', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const validatedData = createAppointmentSchema.parse(req.body);
        // Verify client exists
        const client = await prismaClient_1.default.client.findUnique({
            where: { id: validatedData.clientId },
        });
        if (!client) {
            return res.status(400).json({ error: 'Invalid client' });
        }
        // Verify product exists
        const product = await prismaClient_1.default.product.findUnique({
            where: { id: validatedData.productId },
        });
        if (!product) {
            return res.status(400).json({ error: 'Invalid product' });
        }
        // ===== VALIDACIÓN DE HORARIOS COMERCIALES =====
        const appointmentDate = new Date(validatedData.date);
        const dayOfWeek = appointmentDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const businessHour = await prismaClient_1.default.businessHour.findUnique({
            where: { dayOfWeek },
        });
        if (!businessHour || !businessHour.isOpen) {
            return res.status(400).json({ error: 'El salón está cerrado en este horario' });
        }
        // Si el admin configuró timeSlots explícitos, el inicio de la cita debe coincidir con uno de ellos.
        if (Array.isArray(businessHour.timeSlots) && businessHour.timeSlots.length > 0) {
            if (!businessHour.timeSlots.includes(validatedData.startTime)) {
                return res.status(400).json({ error: 'El horario seleccionado no está permitido para este día' });
            }
        }
        // Convert request times to minutes para comparaciones de rango (compatibilidad retro)
        const [reqStartHour, reqStartMin] = validatedData.startTime.split(':').map(Number);
        const [reqEndHour, reqEndMin] = validatedData.endTime.split(':').map(Number);
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
        // Check for conflicting appointments: mismo día, misma hora (startTime) y no canceladas
        const startOfDay = new Date(`${validatedData.date.split('T')[0]}T00:00:00.000`);
        const endOfDay = new Date(`${validatedData.date.split('T')[0]}T23:59:59.999`);
        const conflictingSameTime = await prismaClient_1.default.appointment.findFirst({
            where: {
                date: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
                startTime: validatedData.startTime,
                status: 'SCHEDULED',
            },
        });
        if (conflictingSameTime) {
            return res.status(400).json({ error: 'Ya existe una cita en ese horario' });
        }
        // Check whether same client already has appointment on that day (opcional)
        const conflictingAppointment = await prismaClient_1.default.appointment.findFirst({
            where: {
                clientId: validatedData.clientId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
                status: { not: 'CANCELLED' },
            },
        });
        if (conflictingAppointment) {
            return res.status(400).json({ error: 'El cliente ya tiene una cita para ese día' });
        }
        const appointment = await prismaClient_1.default.appointment.create({
            data: {
                date: new Date(validatedData.date),
                startTime: validatedData.startTime,
                endTime: validatedData.endTime,
                status: validatedData.status,
                notes: validatedData.notes,
                clientId: validatedData.clientId,
                productId: validatedData.productId,
            },
            include: {
                client: true,
                product: true,
            },
        });
        try {
            await notificationService_1.default.createNotification({
                type: 'SYSTEM',
                recipient: 'ADMIN',
                content: `Nueva cita agendada (admin): cliente ${appointment.client.name} - servicio ${appointment.product.name}, fecha ${new Date(appointment.date).toLocaleDateString('es-ES')} ${appointment.startTime}-${appointment.endTime}`,
            });
            await notificationService_1.default.createNotification({
                type: 'SYSTEM',
                recipient: appointment.clientId,
                clientId: appointment.clientId,
                content: `Tu cita para ${appointment.product.name} ha sido agendada para ${new Date(appointment.date).toLocaleDateString('es-ES')} a las ${appointment.startTime}.`,
            });
        }
        catch (notifError) {
            console.error('Error crearing appointment notifications:', notifError);
        }
        res.status(201).json(appointment);
    }
    catch (error) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        console.error('Error creating appointment:', error);
        res.status(500).json({ error: 'Failed to create appointment' });
    }
});
// PUT /api/appointments/:id - Update an appointment
router.put('/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const validatedData = updateAppointmentSchema.parse(req.body);
        // Verify appointment exists
        const existingAppointment = await prismaClient_1.default.appointment.findUnique({
            where: { id },
        });
        if (!existingAppointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        // If client is being changed, verify new client exists
        if (validatedData.clientId && validatedData.clientId !== existingAppointment.clientId) {
            const client = await prismaClient_1.default.client.findUnique({
                where: { id: validatedData.clientId },
            });
            if (!client) {
                return res.status(400).json({ error: 'Invalid client' });
            }
        }
        // If product is being changed, verify new product exists
        if (validatedData.productId && validatedData.productId !== existingAppointment.productId) {
            const product = await prismaClient_1.default.product.findUnique({
                where: { id: validatedData.productId },
            });
            if (!product) {
                return res.status(400).json({ error: 'Invalid product' });
            }
        }
        // ===== VALIDACIÓN DE HORARIOS COMERCIALES =====
        const dateToCheck = validatedData.date ? new Date(validatedData.date) : existingAppointment.date;
        const startTimeToCheck = validatedData.startTime || existingAppointment.startTime;
        const endTimeToCheck = validatedData.endTime || existingAppointment.endTime;
        const dayOfWeek = dateToCheck.getDay();
        const businessHour = await prismaClient_1.default.businessHour.findUnique({
            where: { dayOfWeek },
        });
        if (!businessHour || !businessHour.isOpen) {
            return res.status(400).json({ error: 'El salón está cerrado en este horario' });
        }
        const [reqStartHour, reqStartMin] = startTimeToCheck.split(':').map(Number);
        const [reqEndHour, reqEndMin] = endTimeToCheck.split(':').map(Number);
        const [shopStartHour, shopStartMin] = businessHour.startTime.split(':').map(Number);
        const [shopEndHour, shopEndMin] = businessHour.endTime.split(':').map(Number);
        const reqStartMinutes = reqStartHour * 60 + reqStartMin;
        const reqEndMinutes = reqEndHour * 60 + reqEndMin;
        const shopStartMinutes = shopStartHour * 60 + shopStartMin;
        const shopEndMinutes = shopEndHour * 60 + shopEndMin;
        if (reqStartMinutes < shopStartMinutes || reqEndMinutes > shopEndMinutes) {
            return res.status(400).json({ error: 'El salón está cerrado en este horario' });
        }
        const dataToUpdate = {};
        if (validatedData.date)
            dataToUpdate.date = new Date(validatedData.date);
        if (validatedData.startTime)
            dataToUpdate.startTime = validatedData.startTime;
        if (validatedData.endTime)
            dataToUpdate.endTime = validatedData.endTime;
        if (validatedData.status)
            dataToUpdate.status = validatedData.status;
        if (validatedData.notes !== undefined)
            dataToUpdate.notes = validatedData.notes;
        if (validatedData.clientId)
            dataToUpdate.clientId = validatedData.clientId;
        if (validatedData.productId)
            dataToUpdate.productId = validatedData.productId;
        const appointment = await prismaClient_1.default.appointment.update({
            where: { id },
            data: dataToUpdate,
            include: {
                client: true,
                product: true,
            },
        });
        // Notificar a la clienta si la cita se cancela
        const updatedStatus = dataToUpdate.status || existingAppointment.status;
        if (updatedStatus === 'CANCELLED' && existingAppointment.status !== 'CANCELLED') {
            try {
                if (appointment.clientId) {
                    await notificationService_1.default.createNotification({
                        type: 'SYSTEM',
                        recipient: appointment.clientId,
                        clientId: appointment.clientId,
                        content: `Tu cita para ${appointment.product?.name ?? 'este servicio'} el ${new Date(appointment.date).toLocaleDateString('es-ES')} a las ${appointment.startTime} ha sido cancelada.`,
                    });
                }
                await notificationService_1.default.createNotification({
                    type: 'SYSTEM',
                    recipient: 'ADMIN',
                    content: `La cita #${appointment.id} ha sido cancelada por el admin.`,
                });
            }
            catch (notifError) {
                console.error('Error creating cancellation notifications:', notifError);
            }
        }
        res.json(appointment);
    }
    catch (error) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        console.error('Error updating appointment:', error);
        res.status(500).json({ error: 'Failed to update appointment' });
    }
});
// DELETE /api/appointments/:id - Delete an appointment
router.delete('/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // Verify appointment exists
        const appointment = await prismaClient_1.default.appointment.findUnique({
            where: { id },
        });
        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        await prismaClient_1.default.appointment.delete({
            where: { id },
        });
        try {
            if (appointment.clientId) {
                await notificationService_1.default.createNotification({
                    type: 'SYSTEM',
                    recipient: appointment.clientId,
                    clientId: appointment.clientId,
                    content: `Tu cita programada para ${new Date(appointment.date).toLocaleDateString('es-ES')} a las ${appointment.startTime} ha sido eliminada por el salón.`,
                });
            }
            await notificationService_1.default.createNotification({
                type: 'SYSTEM',
                recipient: 'ADMIN',
                content: `La cita #${appointment.id} ha sido eliminada del sistema.`,
            });
        }
        catch (notifError) {
            console.error('Error creating delete notifications:', notifError);
        }
        res.json({ message: 'Appointment deleted successfully' });
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
            return res.status(409).json({
                error: 'Cannot delete this appointment due to related data in the system.',
            });
        }
        console.error('Error deleting appointment:', error);
        res.status(500).json({ error: 'Failed to delete appointment' });
    }
});
exports.default = router;
