import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useClientAppointments } from '../../hooks/useQueries';
import { Calendar, Clock, CheckCircle, AlertCircle, Image, Sparkles, CreditCard, User } from 'lucide-react';
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
        <h1 className="text-3xl font-bold text-foreground">
          Bienvenida, {user?.name}! ✨
        </h1>
        <p className="text-muted-foreground mt-2">Aquí está tu resumen personal</p>
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
              className="bg-card text-purple-600 hover:bg-muted font-semibold px-6 py-3 rounded-lg"
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
              className="bg-card text-blue-600 hover:bg-muted font-semibold px-6 py-3 rounded-lg"
            >
              Agendar cita
            </Button>
          </div>
        </div>
      )}

      {/* Historial de Citas Completadas */}
      <div>
        <h3 className="text-2xl font-bold text-foreground mb-6">
          Tus citas completadas
        </h3>

        {lastCompletedAppointments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {lastCompletedAppointments.map((appointment: Appointment) => (
              <div
                key={appointment.id}
                className="rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <CheckCircle className="h-5 w-5 text-green-600 mb-2" />
                    <h4 className="font-semibold text-foreground text-lg">
                      {appointment.product?.name || 'Servicio'}
                    </h4>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-2" />
                    {formatDateShort(appointment.date, appointment.startTime)}
                  </div>

                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 mr-2" />
                    {appointment.startTime} - {appointment.endTime}
                  </div>

                  {appointment.product?.price && (
                    <div className="pt-2 border-t border-border mt-4">
                      <p className="text-sm font-medium text-foreground">
                        💰 ${Number(appointment.product.price).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>

                {appointment.notes && (
                  <p className="mt-4 text-xs text-muted-foreground italic px-3 py-2 bg-muted rounded">
                    {appointment.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted p-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">
              Aún no has completado ninguna cita
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              Cuando completes una cita, aparecerá aquí tu historial
            </p>
          </div>
        )}
      </div>

      {/* CTA de Inspiración */}
      <div className="mt-8 rounded-3xl border border-purple-200 dark:border-purple-900 bg-gradient-to-r from-purple-50 to-white dark:from-purple-950/40 dark:to-card p-6 shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-purple-100 dark:bg-purple-900/50 p-4 text-purple-700 dark:text-purple-300">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground">
                ¿Buscas inspiración para tu próxima visita?
              </h3>
              <p className="mt-2 text-muted-foreground">
                Explora nuestra galería de trabajos y encuentra el estilo perfecto para ti.
              </p>
            </div>
          </div>
          <Link
            to="/portal/gallery"
            className="inline-flex items-center justify-center rounded-full bg-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700"
          >
            Ver Galería
          </Link>
        </div>
      </div>

      {/* Sección de enlaces rápidos */}
      <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-2xl font-bold text-foreground">Enlaces rápidos</h3>
        <p className="text-muted-foreground mt-2">Navega rápido a las secciones más usadas</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/portal/appointments')}
            className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-left transition hover:bg-purple-50 dark:hover:bg-purple-950/40"
          >
            <Calendar className="h-5 w-5 text-purple-600" />
            Mis citas
          </button>

          <button
            onClick={() => navigate('/portal/gallery')}
            className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-left transition hover:bg-purple-50 dark:hover:bg-purple-950/40"
          >
            <Image className="h-5 w-5 text-purple-600" />
            Galería
          </button>

          <button
            onClick={() => navigate('/portal/my-invoices')}
            className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-left transition hover:bg-purple-50 dark:hover:bg-purple-950/40"
          >
            <CreditCard className="h-5 w-5 text-purple-600" />
            Mis facturas
          </button>

          <button
            onClick={() => navigate('/portal/my-profile')}
            className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-left transition hover:bg-purple-50 dark:hover:bg-purple-950/40"
          >
            <User className="h-5 w-5 text-purple-600" />
            Mi perfil
          </button>
        </div>
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
