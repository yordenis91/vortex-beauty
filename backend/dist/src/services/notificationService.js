"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = createNotification;
exports.getAllNotifications = getAllNotifications;
exports.getClientNotifications = getClientNotifications;
exports.markAsRead = markAsRead;
exports.updateNotificationStatus = updateNotificationStatus;
const prismaClient_1 = __importDefault(require("../prismaClient"));
const client_1 = require("@prisma/client");
/**
 * Crea una notificación en la base de datos
 * @param data - Datos de la notificación
 * @returns La notificación creada
 */
async function createNotification(data) {
    try {
        const notification = await prismaClient_1.default.notification.create({
            data: {
                type: data.type,
                recipient: data.recipient,
                content: data.content,
                clientId: data.clientId,
                errorLog: data.errorLog,
                status: data.status || client_1.NotificationStatus.PENDING,
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
    }
    catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
}
/**
 * Obtiene todas las notificaciones (para admin)
 * @returns Array de notificaciones ordenadas por fecha descendente
 */
async function getAllNotifications() {
    try {
        const notifications = await prismaClient_1.default.notification.findMany({
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
    }
    catch (error) {
        console.error('Error fetching all notifications:', error);
        throw error;
    }
}
/**
 * Obtiene las notificaciones de un cliente específico
 * @param clientId - ID del cliente
 * @returns Array de notificaciones del cliente
 */
async function getClientNotifications(clientId) {
    try {
        const notifications = await prismaClient_1.default.notification.findMany({
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
    }
    catch (error) {
        console.error('Error fetching client notifications:', error);
        throw error;
    }
}
/**
 * Marca una notificación como leída
 * @param notificationId - ID de la notificación
 * @returns La notificación actualizada
 */
async function markAsRead(notificationId) {
    try {
        const notification = await prismaClient_1.default.notification.update({
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
    }
    catch (error) {
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
async function updateNotificationStatus(notificationId, status, errorLog) {
    try {
        const notification = await prismaClient_1.default.notification.update({
            where: { id: notificationId },
            data: {
                status,
                errorLog: errorLog || null,
            },
        });
        return notification;
    }
    catch (error) {
        console.error('Error updating notification status:', error);
        throw error;
    }
}
exports.default = {
    createNotification,
    getAllNotifications,
    getClientNotifications,
    markAsRead,
    updateNotificationStatus,
};
