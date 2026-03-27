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
const createTicketSchema = zod_1.z.object({
    subject: zod_1.z.string().min(1, 'Subject is required'),
    description: zod_1.z.string().min(1, 'Description is required'),
    categoryId: zod_1.z.string().uuid('Invalid category ID').optional(),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});
const updateTicketSchema = zod_1.z.object({
    subject: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().min(1).optional(),
    status: zod_1.z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CLIENT', 'RESOLVED', 'CLOSED']).optional(),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    assignedToId: zod_1.z.string().uuid().nullable().optional(),
    categoryId: zod_1.z.string().uuid().optional(),
});
const createMessageSchema = zod_1.z.object({
    message: zod_1.z.string().min(1, 'Message cannot be empty'),
    isInternal: zod_1.z.boolean().default(false),
});
// GET /api/tickets - Get all tickets (for agents) or client tickets
router.get('/', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const userId = req.userId;
        const { status, priority, assignedTo, clientId } = req.query;
        // For now, users can see tickets they created or are assigned to
        // In a real system, you'd have role-based access control
        const where = {
            OR: [
                { userId }, // Tickets created by the user
                { assignedToId: userId }, // Tickets assigned to the user
            ],
        };
        // Add clientId filter if provided
        if (clientId) {
            where.OR.push({ clientId });
        }
        if (status)
            where.status = status;
        if (priority)
            where.priority = priority;
        if (assignedTo)
            where.assignedToId = assignedTo;
        const tickets = await prismaClient_1.default.ticket.findMany({
            where,
            include: {
                category: true,
                client: true,
                assignedTo: true,
                user: true,
                messages: {
                    include: {
                        user: true,
                    },
                    orderBy: {
                        createdAt: 'asc',
                    },
                },
                _count: {
                    select: {
                        messages: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(tickets);
    }
    catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});
// GET /api/tickets/:id - Get a specific ticket
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.userId;
        const ticket = await prismaClient_1.default.ticket.findFirst({
            where: {
                id,
                OR: [
                    { userId }, // Created by user
                    { assignedToId: userId }, // Assigned to user
                    { client: { userId } }, // Client belongs to user
                ],
            },
            include: {
                category: true,
                client: true,
                assignedTo: true,
                user: true,
                messages: {
                    include: {
                        user: true,
                    },
                    orderBy: {
                        createdAt: 'asc',
                    },
                },
                _count: {
                    select: {
                        messages: true,
                    },
                },
            },
        });
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        res.json(ticket);
    }
    catch (error) {
        console.error('Error fetching ticket:', error);
        res.status(500).json({ error: 'Failed to fetch ticket' });
    }
});
// POST /api/tickets - Create a new ticket
router.post('/', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const userId = req.userId;
        const validatedData = createTicketSchema.parse(req.body);
        // Verify category exists if provided
        if (validatedData.categoryId) {
            const category = await prismaClient_1.default.category.findFirst({
                where: {
                    id: validatedData.categoryId,
                    type: 'TICKET',
                },
            });
            if (!category) {
                return res.status(400).json({ error: 'Invalid ticket category' });
            }
        }
        // For now, tickets are created by users for their own clients
        // In a real system, clients might create tickets through a portal
        const ticketCount = await prismaClient_1.default.ticket.count({
            where: { userId },
        });
        const ticketNumber = `TICK-${String(ticketCount + 1).padStart(6, '0')}`;
        const ticket = await prismaClient_1.default.ticket.create({
            data: {
                ticketNumber,
                subject: validatedData.subject,
                description: validatedData.description,
                categoryId: validatedData.categoryId,
                priority: validatedData.priority,
                userId,
            },
            include: {
                category: true,
                client: true,
                assignedTo: true,
                user: true,
            },
        });
        res.status(201).json(ticket);
    }
    catch (error) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        console.error('Error creating ticket:', error);
        res.status(500).json({ error: 'Failed to create ticket' });
    }
});
// PUT /api/tickets/:id - Update a ticket
router.put('/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.userId;
        const validatedData = updateTicketSchema.parse(req.body);
        // Verify ticket exists and user has access
        const existingTicket = await prismaClient_1.default.ticket.findFirst({
            where: {
                id,
                OR: [
                    { userId },
                    { assignedToId: userId },
                    { client: { userId } },
                ],
            },
        });
        if (!existingTicket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        // Verify category if being updated
        if (validatedData.categoryId) {
            const category = await prismaClient_1.default.category.findFirst({
                where: {
                    id: validatedData.categoryId,
                    type: 'TICKET',
                },
            });
            if (!category) {
                return res.status(400).json({ error: 'Invalid ticket category' });
            }
        }
        // Verify assigned user exists if being updated
        if (validatedData.assignedToId) {
            const assignedUser = await prismaClient_1.default.user.findUnique({
                where: { id: validatedData.assignedToId },
            });
            if (!assignedUser) {
                return res.status(400).json({ error: 'Invalid assigned user' });
            }
        }
        const ticket = await prismaClient_1.default.ticket.update({
            where: { id },
            data: validatedData,
            include: {
                category: true,
                client: true,
                assignedTo: true,
                user: true,
            },
        });
        res.json(ticket);
    }
    catch (error) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        console.error('Error updating ticket:', error);
        res.status(500).json({ error: 'Failed to update ticket' });
    }
});
// POST /api/tickets/:id/messages - Add a message to a ticket
router.post('/:id/messages', auth_1.authenticateToken, async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.userId;
        const validatedData = createMessageSchema.parse(req.body);
        // Verify ticket exists and user has access
        const ticket = await prismaClient_1.default.ticket.findFirst({
            where: {
                id,
                OR: [
                    { userId },
                    { assignedToId: userId },
                    { client: { userId } },
                ],
            },
        });
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        const message = await prismaClient_1.default.ticketMessage.create({
            data: {
                message: validatedData.message,
                isInternal: validatedData.isInternal,
                ticketId: id,
                userId,
            },
            include: {
                user: true,
            },
        });
        res.status(201).json(message);
    }
    catch (error) {
        if (error?.name === 'ZodError') {
            return res.status(400).json({ error: 'Validation error', details: error.issues });
        }
        console.error('Error creating message:', error);
        res.status(500).json({ error: 'Failed to create message' });
    }
});
// DELETE /api/tickets/:id - Delete a ticket (admin only)
router.delete('/:id', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.userId;
        // Verify ticket exists and belongs to user
        const ticket = await prismaClient_1.default.ticket.findFirst({
            where: {
                id,
                OR: [
                    { userId },
                    { assignedToId: userId },
                    { client: { userId } },
                ],
            },
        });
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        // Only allow deletion of closed tickets
        if (ticket.status !== 'CLOSED') {
            return res.status(400).json({ error: 'Only closed tickets can be deleted' });
        }
        await prismaClient_1.default.ticket.delete({
            where: { id },
        });
        res.json({ message: 'Ticket deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting ticket:', error);
        res.status(500).json({ error: 'Failed to delete ticket' });
    }
});
exports.default = router;
