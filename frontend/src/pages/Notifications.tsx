import React, { useMemo } from 'react';
import { useNotifications } from '../hooks/useQueries';
import { Mail, MessageSquare, Bell, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';

interface Notification {
  id: string;
  type: 'WHATSAPP' | 'EMAIL' | 'SYSTEM';
  recipient: string;
  content: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  isRead: boolean;
  errorLog?: string;
  clientId?: string;
  createdAt: string;
  updatedAt: string;
  client?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
}

const Notifications: React.FC = () => {
  const { data: notifications = [], isLoading } = useNotifications();

  // Estadísticas
  const stats = useMemo(() => {
    return {
      total: notifications.length,
      pending: notifications.filter((n: Notification) => n.status === 'PENDING').length,
      sent: notifications.filter((n: Notification) => n.status === 'SENT').length,
      failed: notifications.filter((n: Notification) => n.status === 'FAILED').length,
    };
  }, [notifications]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'WHATSAPP':
        return <MessageSquare className="h-5 w-5 text-green-600" />;
      case 'EMAIL':
        return <Mail className="h-5 w-5 text-blue-600" />;
      case 'SYSTEM':
        return <Bell className="h-5 w-5 text-purple-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Pendiente
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Enviado
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Error
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'dd MMM yyyy HH:mm', { locale: es });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
          Centro de Notificaciones
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Registro y auditoría de todas las notificaciones enviadas a clientes
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 font-medium">Total</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-yellow-600 font-medium">Pendientes</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-green-600 font-medium">Enviadas</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{stats.sent}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-red-600 font-medium">Errores</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{stats.failed}</p>
        </div>
      </div>

      {/* Tabla de Notificaciones */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No hay notificaciones</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Destinatario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Mensaje (Preview)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {notifications.map((notification: Notification) => (
                  <tr key={notification.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(notification.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(notification.type)}
                        <span className="text-sm font-medium text-gray-900">
                          {notification.type === 'WHATSAPP' ? 'WhatsApp' : notification.type === 'EMAIL' ? 'Email' : 'Sistema'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {notification.recipient}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {notification.client ? (
                        <div>
                          <p className="font-medium text-gray-900">{notification.client.name}</p>
                          <p className="text-xs text-gray-500">{notification.client.email}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-xs">
                      <p className="truncate">{notification.content}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(notification.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Leyenda */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Nota:</strong> Este panel muestra todas las notificaciones enviadas a los clientes incluidas WhatsApp, Email y notificaciones del sistema.
          Cada fila incluye información del remitente, destinatario y estado actual del envío.
        </p>
      </div>
    </div>
  );
};

export default Notifications;
