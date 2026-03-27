import express from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1),
  issueDate: z.string().transform(str => new Date(str)),
  dueDate: z.string().transform(str => new Date(str)),
  status: z.enum(['PENDING', 'PAID', 'CANCELLED', 'OVERDUE']).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  clientId: z.string(),
  projectId: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().min(0),
    unitPrice: z.number().min(0),
  })),
});

// GET /api/invoices - List all invoices
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { userId: (req as any).userId },
      include: { client: true, project: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/invoices - Create new invoice
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { items, ...invoiceData } = invoiceSchema.parse(req.body);

    // Calcula subtotal en backend (ignora subtotal/totalAmount de req.body)
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const taxRate = invoiceData.taxRate ?? 0;
    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: invoiceData.invoiceNumber,
        issueDate: invoiceData.issueDate,
        dueDate: invoiceData.dueDate,
        status: invoiceData.status || 'PENDING',
        clientId: invoiceData.clientId,
        projectId: invoiceData.projectId,
        notes: invoiceData.notes,
        subtotal,
        taxRate,
        totalAmount,
        userId: (req as any).userId,
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
  } catch (error: any) { // Le decimos a TS que confíe en nosotros aquí temporalmente
    // Usamos el método interno de Zod para verificar o simplemente asumimos si tiene name
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    
    console.error(error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /api/invoices/:id - Update invoice
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { items, ...invoiceData } = invoiceSchema.parse(req.body);

    // Calcula subtotal en backend (ignora subtotal/totalAmount de req.body)
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const taxRate = invoiceData.taxRate ?? 0;
    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id as string },
      data: {
        invoiceNumber: invoiceData.invoiceNumber,
        issueDate: invoiceData.issueDate,
        dueDate: invoiceData.dueDate,
        status: invoiceData.status || 'PENDING',
        clientId: invoiceData.clientId,
        projectId: invoiceData.projectId,
        notes: invoiceData.notes,
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
  } catch (error: any) { // Le decimos a TS que confíe en nosotros aquí temporalmente
    // Usamos el método interno de Zod para verificar o simplemente asumimos si tiene name
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    
    console.error(error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

// DELETE /api/invoices/:id - Delete invoice
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await prisma.invoice.delete({
      where: { id: req.params.id as string },
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;