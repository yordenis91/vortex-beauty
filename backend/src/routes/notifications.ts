import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import notificationService from '../services/notificationService';
import prisma from '../prismaClient';
import { retryNotification } from '../services/notifications/notifier';

const router = Router();

const statusSchema = z.object({
  status: z.enum(['PENDING', 'SENT', 'FAILED']),
  errorLog: z.string().max(2000).optional(),
});

const logQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['PENDING', 'SENT', 'FAILED']).optional(),
  channel: z.enum(['EMAIL', 'TELEGRAM', 'WHATSAPP']).optional(),
  audience: z.enum(['CLIENTS', 'TEAM']).optional(),
});

/**
 * GET /api/notifications/log
 * Registro de envíos (correo y Telegram) del salón, paginado y con filtros por estado, canal y público (Solo ADMIN).
 */
router.get('/log', authenticateToken, requireAdmin, async (req: any, res: Response) => {
  try {
    const query = logQuery.parse(req.query);
    res.json(await notificationService.getSendLog(req.user.tenantId, query));
  } catch (error: any) {
    if (error?.name === 'ZodError') return res.status(400).json({ error: 'Parámetros inválidos', details: error.issues });
    console.error('Error fetching send log:', error);
    res.status(500).json({ error: 'No se pudo cargar el registro de envíos' });
  }
});

/**
 * POST /api/notifications/:id/retry
 * Reintenta un envío fallido (Solo ADMIN). Los ya enviados no se repiten.
 */
router.post('/:id/retry', authenticateToken, requireAdmin, async (req: any, res: Response) => {
  try {
    const result = await retryNotification(req.user.tenantId, String(req.params.id));
    if (result === 'not-retryable') return res.status(409).json({ error: 'Este envío no se puede reintentar.' });
    res.json({ result });
  } catch (error) {
    console.error('Error retrying notification:', error);
    res.status(500).json({ error: 'No se pudo reintentar el envío' });
  }
});

/**
 * GET /api/notifications/client
 * Obtiene las notificaciones del cliente autenticado
 * Solo retorna notificaciones asociadas al clientId del usuario
 */
router.get('/client', authenticateToken, async (req: any, res: Response) => {
  try {
    const clientId = req.user?.clientId;

    if (!clientId) {
      return res.json([]);
    }

    const notifications = await notificationService.getClientNotifications(clientId, req.user.tenantId);
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching client notifications:', error);
    res.status(500).json({ error: 'Failed to fetch client notifications' });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Marca una notificación como leída
 * El cliente solo puede marcar sus propias notificaciones
 */
router.put('/:id/read', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const clientId = req.user?.clientId;

    // Verificar que la notificación pertenece al salón (y al cliente, si aplica)
    const notification = await prisma.notification.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Si es cliente y la notificación no es suya, rechazar
    if (req.user?.role === 'CLIENT' && notification.clientId !== clientId) {
      return res.status(403).json({ error: 'Forbidden: Cannot mark other client notifications as read' });
    }

    const updatedNotification = await notificationService.markAsRead(id);
    res.json(updatedNotification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * PUT /api/notifications/:id/status
 * Actualiza el estado de una notificación (Solo ADMIN)
 */
router.put('/:id/status', authenticateToken, requireAdmin, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
    }
    const { status, errorLog } = parsed.data;

    const existing = await prisma.notification.findFirst({ where: { id, tenantId: req.user.tenantId } });
    if (!existing) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updatedNotification = await notificationService.updateNotificationStatus(id, status, errorLog);
    res.json(updatedNotification);
  } catch (error) {
    console.error('Error updating notification status:', error);
    res.status(500).json({ error: 'Failed to update notification status' });
  }
});

export default router;
