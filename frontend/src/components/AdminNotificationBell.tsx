import React, { useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useNotifications } from '../hooks/useQueries'; // Ajusta la ruta relativa según corresponda

const AdminNotificationBell: React.FC = () => {
  const { data: notifications = [] } = useNotifications();
  
  const prevCountRef = useRef(notifications.length);

  const unreadCount = useMemo(() => {
    return notifications.filter((n: any) => !n.isRead).length;
  }, [notifications]);

  useEffect(() => {
    if (notifications.length > prevCountRef.current) {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(error => {
        console.warn("Navegador bloqueó el autoplay del sonido:", error);
      });
    }
    prevCountRef.current = notifications.length;
  }, [notifications]);

  return (
    <Link
      to="/admin/notifications"
      className="relative p-2 text-gray-500 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
      title="Notificaciones"
    >
      <span className="sr-only">Ver notificaciones</span>
      <Bell className="h-6 w-6" />
      
      {unreadCount > 0 && (
        <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center transform translate-x-1 -translate-y-1 shadow-sm border-2 border-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
};

export default AdminNotificationBell;
