import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import notificationService from '../services/notificationService';
import prisma from '../prismaClient';

const router = Router();

/**
 * GET /api/notifications
 * Obtiene todas las notificaciones (Solo ADMIN)
 * Devuelve todas las notificaciones ordenadas por fecha descendente
 */
router.get('/', authenticateToken, requireAdmin, async (req: any, res: Response) => {
  try {
    const notifications = await notificationService.getAllNotifications();
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
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

    const notifications = await notificationService.getClientNotifications(clientId);
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

    // Verificar que la notificación pertenece al cliente
    const notification = await prisma.notification.findUnique({
      where: { id },
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
    const { status, errorLog } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const updatedNotification = await notificationService.updateNotificationStatus(id, status, errorLog);
    res.json(updatedNotification);
  } catch (error) {
    console.error('Error updating notification status:', error);
    res.status(500).json({ error: 'Failed to update notification status' });
  }
});

export default router;
