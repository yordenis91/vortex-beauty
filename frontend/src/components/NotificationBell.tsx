import React, { useState, useRef, useEffect } from 'react';
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

const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: notifications = [], isLoading } = useClientNotifications();
  const markAsReadMutation = useMarkNotificationAsRead();

  const unreadCount = notifications.filter((n: Notification) => !n.isRead).length;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markAsReadMutation.mutateAsync(notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const getNotificationTypeColor = (type: string) => {
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

  const sortedNotifications = [...notifications].sort(
    (a: Notification, b: Notification) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const recentNotifications = sortedNotifications.slice(0, 5);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
        aria-label="Notificaciones"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full h-5 w-5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute -right-2 sm:right-0 mt-2 w-[calc(100vw-2rem)] max-w-[340px] sm:max-w-none sm:w-96 bg-white rounded-lg shadow-xl z-50 border border-gray-200 overflow-hidden origin-top-right">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <h3 className="text-sm font-semibold">Notificaciones</h3>
            {unreadCount > 0 && (
              <p className="text-xs opacity-90 mt-1">{unreadCount} sin leer</p>
            )}
          </div>

          {/* Content */}
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="text-center py-8 px-4">
                <Bell className="h-8 w-8 text-gray-400 mx-auto mb-2 opacity-50" />
                <p className="text-gray-600 text-sm">No hay notificaciones</p>
              </div>
            ) : (
              recentNotifications.map((notification: Notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer border-l-4 ${
                    !notification.isRead ? 'bg-blue-50 border-blue-500' : 'border-transparent'
                  }`}
                  onClick={(e) => {
                    if (!notification.isRead) {
                      handleMarkAsRead(notification.id, e as any);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${getNotificationTypeColor(notification.type)}`}>
                          {notification.type === 'WHATSAPP' ? '💬' : notification.type === 'EMAIL' ? '📧' : '🔔'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 font-medium line-clamp-2">
                        {notification.content}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <div className="flex-shrink-0 mt-1">
                        <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer - Ver todas */}
          {notifications.length > 5 && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-center">
              <a href="/admin/notifications" className="text-xs text-blue-600 hover:text-blue-700 font-semibold">
                Ver todas las notificaciones →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
