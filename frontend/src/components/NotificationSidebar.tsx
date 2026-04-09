import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Bell } from 'lucide-react';
import { useClientNotifications, useMarkNotificationAsRead } from '../hooks/useQueries';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';

interface Notification {
  id: string;
  type: 'WHATSAPP' | 'EMAIL' | 'SYSTEM';
  recipient: string;
  content: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  isRead: boolean;
  createdAt: string;
}

const NotificationSidebar: React.FC = () => {
  const { data, isLoading } = useClientNotifications();
  const notifications = (data ?? []) as Notification[];
  const markAsReadMutation = useMarkNotificationAsRead();

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  const formatDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

      if (diffMinutes < 1) return 'Ahora';
      if (diffMinutes < 60) return `${diffMinutes}m`;
      if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h`;
      return format(date, 'dd MMM', { locale: es });
    } catch {
      return dateString;
    }
  };

  const getNotificationTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'WHATSAPP':
        return 'bg-green-100 border-green-300';
      case 'EMAIL':
        return 'bg-blue-100 border-blue-300';
      case 'SYSTEM':
        return 'bg-purple-100 border-purple-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  const handleMarkAsRead = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markAsReadMutation.mutateAsync(notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const recentNotifications = sortedNotifications.slice(0, 5);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 shadow-sm" />
          )}
        </button>
      </SheetTrigger>

      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Notificaciones</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-sm font-medium text-gray-900">Tienes {unreadCount} notificación{unreadCount === 1 ? '' : 'es'} sin leer</p>
            <p className="text-sm text-gray-500">Últimas actualizaciones del sistema y mensajes importantes.</p>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Bell className="h-10 w-10 text-gray-400 mx-auto mb-3 opacity-60" />
                <p className="text-sm text-gray-600">No hay notificaciones en este momento.</p>
              </div>
            ) : (
              recentNotifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={(e) => handleMarkAsRead(notification.id, e)}
                  className={`w-full text-left rounded-2xl border px-4 py-4 transition-colors ${
                    !notification.isRead ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${getNotificationTypeColor(notification.type)}`}
                        >
                          {notification.type === 'WHATSAPP' ? '💬' : notification.type === 'EMAIL' ? '📧' : '🔔'} {notification.type.toLowerCase()}
                        </span>
                        <span className="text-xs text-gray-500">{formatDate(notification.createdAt)}</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 leading-6">{notification.content}</p>
                    </div>
                    {!notification.isRead && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-600" />}
                  </div>
                </button>
              ))
            )}
          </div>

          {notifications.length > 5 && (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-center">
              <a href="/admin/notifications" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                Ver todas las notificaciones →
              </a>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default NotificationSidebar;
