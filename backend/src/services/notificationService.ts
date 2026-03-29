import prisma from '../prismaClient';
import { NotificationType, NotificationStatus } from '@prisma/client';

interface CreateNotificationData {
  type: NotificationType;
  recipient: string;
  content: string;
  clientId?: string;
  errorLog?: string;
  status?: NotificationStatus;
}

/**
 * Crea una notificación en la base de datos
 * @param data - Datos de la notificación
 * @returns La notificación creada
 */
export async function createNotification(data: CreateNotificationData) {
  try {
    const notification = await prisma.notification.create({
      data: {
        type: data.type,
        recipient: data.recipient,
        content: data.content,
        clientId: data.clientId,
        errorLog: data.errorLog,
        status: data.status || NotificationStatus.PENDING,
        isRead: false,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    console.log(`[Notification Created] Type: ${data.type}, Recipient: ${data.recipient}, Status: ${notification.status}`);
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Obtiene todas las notificaciones (para admin)
 * @returns Array de notificaciones ordenadas por fecha descendente
 */
export async function getAllNotifications() {
  try {
    const notifications = await prisma.notification.findMany({
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return notifications;
  } catch (error) {
    console.error('Error fetching all notifications:', error);
    throw error;
  }
}

/**
 * Obtiene las notificaciones de un cliente específico
 * @param clientId - ID del cliente
 * @returns Array de notificaciones del cliente
 */
export async function getClientNotifications(clientId: string) {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        clientId,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return notifications;
  } catch (error) {
    console.error('Error fetching client notifications:', error);
    throw error;
  }
}

/**
 * Marca una notificación como leída
 * @param notificationId - ID de la notificación
 * @returns La notificación actualizada
 */
export async function markAsRead(notificationId: string) {
  try {
    const notification = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    return notification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Actualiza el estado de una notificación
 * @param notificationId - ID de la notificación
 * @param status - Nuevo estado
 * @param errorLog - Log de error (opcional)
 * @returns La notificación actualizada
 */
export async function updateNotificationStatus(
  notificationId: string,
  status: NotificationStatus,
  errorLog?: string
) {
  try {
    const notification = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status,
        errorLog: errorLog || null,
      },
    });
    return notification;
  } catch (error) {
    console.error('Error updating notification status:', error);
    throw error;
  }
}

export default {
  createNotification,
  getAllNotifications,
  getClientNotifications,
  markAsRead,
  updateNotificationStatus,
};
