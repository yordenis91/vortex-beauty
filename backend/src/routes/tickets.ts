import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Validation schemas
const createTicketSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  description: z.string().min(1, 'Description is required'),
  categoryId: z.string().uuid('Invalid category ID').optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

const updateTicketSchema = z.object({
  subject: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CLIENT', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().optional(),
});

const createMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  isInternal: z.boolean().default(false),
});

// GET /api/tickets - Get all tickets (for agents) or client tickets
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { status, priority, assignedTo, clientId } = req.query;

    // For now, users can see tickets they created or are assigned to
    // In a real system, you'd have role-based access control
    const where: any = {
      OR: [
        { userId }, // Tickets created by the user
        { assignedToId: userId }, // Tickets assigned to the user
      ],
    };

    // Add clientId filter if provided
    if (clientId) {
      where.OR.push({ clientId });
    }

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assignedTo) where.assignedToId = assignedTo;

    const tickets = await prisma.ticket.findMany({
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
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// GET /api/tickets/:id - Get a specific ticket
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id as string;
    const userId = (req as any).userId;

    const ticket = await prisma.ticket.findFirst({
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
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// POST /api/tickets - Create a new ticket
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const validatedData = createTicketSchema.parse(req.body);

    // Verify category exists if provided
    if (validatedData.categoryId) {
      const category = await prisma.category.findFirst({
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
    const ticketCount = await prisma.ticket.count({
      where: { userId },
    });

    const ticketNumber = `TICK-${String(ticketCount + 1).padStart(6, '0')}`;

    const ticket = await prisma.ticket.create({
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
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }

    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// PUT /api/tickets/:id - Update a ticket
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id as string;
    const userId = (req as any).userId;
    const validatedData = updateTicketSchema.parse(req.body);

    // Verify ticket exists and user has access
    const existingTicket = await prisma.ticket.findFirst({
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
      const category = await prisma.category.findFirst({
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
      const assignedUser = await prisma.user.findUnique({
        where: { id: validatedData.assignedToId },
      });

      if (!assignedUser) {
        return res.status(400).json({ error: 'Invalid assigned user' });
      }
    }

    const ticket = await prisma.ticket.update({
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
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }

    console.error('Error updating ticket:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

// POST /api/tickets/:id/messages - Add a message to a ticket
router.post('/:id/messages', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id as string;
    const userId = (req as any).userId;
    const validatedData = createMessageSchema.parse(req.body);

    // Verify ticket exists and user has access
    const ticket = await prisma.ticket.findFirst({
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

    const message = await prisma.ticketMessage.create({
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
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }

    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// DELETE /api/tickets/:id - Delete a ticket (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id as string;
    const userId = (req as any).userId;

    // Verify ticket exists and belongs to user
    const ticket = await prisma.ticket.findFirst({
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

    await prisma.ticket.delete({
      where: { id },
    });

    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
});

export default router;