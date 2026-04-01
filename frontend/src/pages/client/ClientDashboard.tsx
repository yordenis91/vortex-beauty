import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useClientAppointments } from '../../hooks/useQueries';
import { Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { format, parseISO, isFuture } from 'date-fns';
import { es } from 'date-fns/locale/es';

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  clientId: string;
  productId: string;
  createdAt: string;
  updatedAt: string;
  client?: {
    id: string;
    name: string;
    email: string;
  };
  product?: {
    id: string;
    name: string;
    price: number;
  };
}

const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: appointments = [] } = useClientAppointments();

  // Las citas ya están filtradas por cliente en el backend, no necesitamos filtro adicional
  const clientAppointments = appointments;

  // Encontrar la próxima cita (SCHEDULED y en el futuro)
  const nextAppointment = useMemo(() => {
    const scheduled = clientAppointments
      .filter((apt: Appointment) => {
        const justDate = apt.date.split('T')[0];
        const aptDateTime = parseISO(`${justDate}T${apt.startTime}`);
        return apt.status === 'SCHEDULED' && isFuture(aptDateTime);
      })
      .sort((a: Appointment, b: Appointment) => {
        const dateA = parseISO(`${a.date.split('T')[0]}T${a.startTime}`);
        const dateB = parseISO(`${b.date.split('T')[0]}T${b.startTime}`);
        return dateA.getTime() - dateB.getTime();
      });
    return scheduled.length > 0 ? scheduled[0] : null;
  }, [clientAppointments]);

  // Últimas 3 citas completadas
  const lastCompletedAppointments = useMemo(() => {
    return clientAppointments
      .filter((apt: Appointment) => apt.status === 'COMPLETED')
      .sort((a: Appointment, b: Appointment) => {
        const dateA = parseISO(`${a.date.split('T')[0]}T${a.startTime}`);
        const dateB = parseISO(`${b.date.split('T')[0]}T${b.startTime}`);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 3);
  }, [clientAppointments]);

  const formatDate = (date: string, time: string) => {
    try {
      const justDate = date.split('T')[0];
      const dateTime = parseISO(`${justDate}T${time}`);
      return format(dateTime, "EEEE d 'de' MMMM yyyy - HH:mm", { locale: es });
    } catch {
      return 'Fecha no válida';
    }
  };

  const formatDateShort = (date: string, time: string) => {
    try {
      const justDate = date.split('T')[0];
      const dateTime = parseISO(`${justDate}T${time}`);
      return format(dateTime, 'd MMM yyyy', { locale: es });
    } catch {
      return 'Fecha no válida';
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Bienvenida, {user?.name}! ✨
        </h1>
        <p className="text-gray-600 mt-2">Aquí está tu resumen personal</p>
      </div>

      {/* HERO CARD - Próxima Cita */}
      {nextAppointment ? (
        <div className="mb-8 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 p-8 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide opacity-90">
                Tu próxima cita
              </p>
              <h2 className="text-3xl font-bold mt-2">
                {nextAppointment.product?.name || 'Servicio'}
              </h2>
              <div className="flex items-center mt-4 text-lg">
                <Calendar className="h-5 w-5 mr-2" />
                <span>
                  {formatDate(nextAppointment.date, nextAppointment.startTime)}
                </span>
              </div>
              {nextAppointment.product?.price && (
                <p className="mt-2 text-sm opacity-90">
                  💰 ${Number(nextAppointment.product.price).toFixed(2)}
                </p>
              )}
              {nextAppointment.notes && (
                <p className="mt-3 text-sm italic opacity-90">
                  📝 {nextAppointment.notes}
                </p>
              )}
            </div>
            <Button
              onClick={() => navigate('/portal/appointments')}
              className="bg-white text-purple-600 hover:bg-gray-100 font-semibold px-6 py-3 rounded-lg"
            >
              Ver detalles
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-8 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 p-8 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide opacity-90">
                Sin citas próximas
              </p>
              <h2 className="text-3xl font-bold mt-2">
                ¡Agenda tu próxima cita!
              </h2>
              <p className="mt-2 text-sm opacity-90">
                Descubre nuestros servicios de belleza y diseña tu próxima experiencia.
              </p>
            </div>
            <Button
              onClick={() => navigate('/portal/appointments')}
              className="bg-white text-blue-600 hover:bg-gray-100 font-semibold px-6 py-3 rounded-lg"
            >
              Agendar cita
            </Button>
          </div>
        </div>
      )}

      {/* Historial de Citas Completadas */}
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-6">
          Tus citas completadas
        </h3>

        {lastCompletedAppointments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {lastCompletedAppointments.map((appointment: Appointment) => (
              <div
                key={appointment.id}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <CheckCircle className="h-5 w-5 text-green-600 mb-2" />
                    <h4 className="font-semibold text-gray-900 text-lg">
                      {appointment.product?.name || 'Servicio'}
                    </h4>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="h-4 w-4 mr-2" />
                    {formatDateShort(appointment.date, appointment.startTime)}
                  </div>

                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="h-4 w-4 mr-2" />
                    {appointment.startTime} - {appointment.endTime}
                  </div>

                  {appointment.product?.price && (
                    <div className="pt-2 border-t border-gray-200 mt-4">
                      <p className="text-sm font-medium text-gray-900">
                        💰 ${Number(appointment.product.price).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>

                {appointment.notes && (
                  <p className="mt-4 text-xs text-gray-600 italic px-3 py-2 bg-gray-50 rounded">
                    {appointment.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">
              Aún no has completado ninguna cita
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Cuando completes una cita, aparecerá aquí tu historial
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Simple Button component
interface ButtonProps {
  onClick: () => void;
  className: string;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ onClick, className, children }) => (
  <button
    onClick={onClick}
    className={`transition-colors ${className}`}
  >
    {children}
  </button>
);

export default ClientDashboard;
