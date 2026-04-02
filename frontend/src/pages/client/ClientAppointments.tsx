import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useClientAppointments, useClientProducts, useCreateClientAppointment, useAvailableSlots, useClosedDates, useCancelAppointment } from '../../hooks/useQueries';
import { Calendar, CheckCircle, Clock, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO, isBefore, startOfDay, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDay, parse } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { api } from '../../lib/api';

interface BusinessHour {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isOpen: boolean;
  timeSlots?: string[];
  maxAppointments?: number;
  createdAt: string;
  updatedAt: string;
}

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

interface FormData {
  productId: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  resource?: Appointment;
  isAvailabilityMark?: boolean;
}

// Configurar localizer del calendario
const locales = {
  es: es,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const withDragAndDropFn = (withDragAndDrop as any).default || withDragAndDrop;
const DnDCalendar = withDragAndDropFn(BigCalendar as any);

// Hook para obtener horarios comerciales
const useBusinessHours = () => {
  return useQuery<BusinessHour[]>({
    queryKey: ['businessHours'],
    queryFn: async () => {
      const response = await api.get('/settings/business-hours');
      return response.data;
    },
  });
};

const ClientAppointments: React.FC = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<FormData>({
    productId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '11:00',
  });

  const [showForm, setShowForm] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState('week');
  const [selectedEventModal, setSelectedEventModal] = useState<Appointment | null>(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);

  // Hooks
  const { data: appointments = [], isLoading: appointmentsLoading } = useClientAppointments();
  const { data: products = [] } = useClientProducts();
  const { data: availableSlots = [], isLoading: slotsLoading } = useAvailableSlots(formData.date);
  const { data: businessHours = [] } = useBusinessHours();
  const { data: closedDates = [] } = useClosedDates();

  const createMutation = useCreateClientAppointment({
    onSuccess: () => {
      toast.success('¡Cita agendada correctamente!');
      resetForm();
    },
  });

  const cancelMutation = useCancelAppointment({
    onSuccess: () => {
      setSelectedEventModal(null);
      setAppointmentToCancel(null);
    },
  });

  // Estado para rastrear días completamente ocupados
  const [fullyBookedDays, setFullyBookedDays] = useState<Set<string>>(new Set());
  // Función para verificar disponibilidad de todos los días del mes actual
  const checkAllDaysInMonth = async (monthDate: Date) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    // Obtener el último día del mes
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    // Crear array de promesas para verificar cada día en paralelo
    const promises = [];
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);
      if (!isDayBlocked(date)) {
        promises.push(checkDayAvailability(date));
      }
    }

    // Ejecutar todas las verificaciones en paralelo
    await Promise.all(promises);
  };

  useEffect(() => {
    const checkInitialDays = async () => {
      // Verificar TODOS los días del mes actual para detectar días completamente ocupados
      await checkAllDaysInMonth(currentDate);
    };

    checkInitialDays();
  }, [currentDate, businessHours, closedDates]);

  // Actualizar días ocupados cuando se crea una nueva cita
  useEffect(() => {
    if (createMutation.isSuccess) {
      // Re-verificar la disponibilidad del día de la cita creada
      const appointmentDate = new Date(formData.date);
      checkDayAvailability(appointmentDate);
    }
  }, [createMutation.isSuccess]);

  // Función auxiliar para verificar si una fecha específica está bloqueada
  const isSpecificClosedDay = (date: Date, closedDates: any[]): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return closedDates.some(cd => cd.date === dateStr);
  };

  // Función para verificar si un día está bloqueado
  const isDayBlocked = (date: Date): boolean => {
    // Verificar si es una fecha pasada
    if (isBefore(startOfDay(date), startOfDay(new Date()))) {
      return true;
    }

    // Verificar si el día de la semana está desactivado
    const dayOfWeek = date.getDay();
    const businessHour = businessHours.find((bh: BusinessHour) => bh.dayOfWeek === dayOfWeek);
    if (businessHour && !businessHour.isOpen) {
      return true;
    }

    // Verificar si es un día cerrado específico
    if (isSpecificClosedDay(date, closedDates)) {
      return true;
    }

    return false;
  };

  // Función para propiedades personalizadas del día en el calendario
  const customDayPropGetter = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const isFullyBooked = fullyBookedDays.has(dateStr);

    console.log(`Day ${dateStr} - isFullyBooked: ${isFullyBooked}, fullyBookedDays size: ${fullyBookedDays.size}`);

    if (isDayBlocked(date)) {
      return {
        style: {
          backgroundColor: '#cbd5e1',
          opacity: 0.7,
          cursor: 'not-allowed',
        },
      };
    }

    if (isFullyBooked) {
      return {
        style: {
          backgroundColor: '#fbbf24', // Amarillo para días completamente ocupados
          opacity: 0.8,
          cursor: 'not-allowed',
        },
      };
    }

    return {};
  };

  // Componente personalizado para las celdas de fecha en el calendario
  const CustomDateCell = ({ date, label }: { date: Date; label: string }) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const isBlocked = isDayBlocked(date);
    const isFullyBooked = fullyBookedDays.has(dateStr);
    
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <span>{label}</span>
        {isBlocked && <span className="text-xs text-red-600 font-medium">No disponible</span>}
        {isFullyBooked && !isBlocked && <span className="text-xs text-orange-700 font-medium">Completo</span>}
      </div>
    );
  };

  // Filtrar citas de la clienta actual
  const clientAppointments = useMemo(() => {
    return appointments.filter((apt: Appointment) => apt.clientId === user?.id);
  }, [appointments, user?.id]);

  // Próximas citas (SCHEDULED)
  const upcomingAppointments = useMemo(() => {
    return clientAppointments
      .filter((apt: Appointment) => apt.status === 'SCHEDULED')
      .sort((a: Appointment, b: Appointment) => {
        const dateA = parseISO(`${a.date}T${a.startTime}`);
        const dateB = parseISO(`${b.date}T${b.startTime}`);
        return dateA.getTime() - dateB.getTime();
      });
  }, [clientAppointments]);

  // Mapeo de Datos - Transformar appointments al formato del calendario
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return appointments.map((appointment) => {
      const [year, month, day] = appointment.date.split('T')[0].split('-');
      const [startHour, startMin] = appointment.startTime.split(':');
      const [endHour, endMin] = appointment.endTime.split(':');

      const start = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(startHour), parseInt(startMin));
      const end = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(endHour), parseInt(endMin));

      return {
        title: `${appointment.client?.name || 'Sin asignar'} - ${appointment.product?.name || 'Sin servicio'}`,
        start,
        end,
        resource: appointment,
      };
    });
  }, [appointments]);

  // Marca de disponibilidad (eventos fantasma)
  const availabilityMarks = useMemo(() => {
    if (!businessHours || !appointments) return [];

    const marks: any[] = [];
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));

    let loopDate = start;
    while (loopDate <= end) {
      const isPast = isBefore(startOfDay(loopDate), startOfDay(new Date()));
      const isSunday = loopDate.getDay() === 0;
      const formattedLoopDate = format(loopDate, 'yyyy-MM-dd');
      const isSpecificClosed = closedDates?.some((cd: any) => cd.date === formattedLoopDate);

      // No mostrar marcas de disponibilidad si ya sabemos que está completamente ocupado
      if (fullyBookedDays.has(formattedLoopDate)) {
        loopDate = addDays(loopDate, 1);
        continue;
      }

      if (!isPast && !isSunday && !isSpecificClosed) {
        const dayOfWeek = loopDate.getDay();
        const dayConfig = businessHours.find((bh: any) => bh.dayOfWeek === dayOfWeek);

        if (dayConfig && dayConfig.isOpen && dayConfig.timeSlots && dayConfig.timeSlots.length > 0) {
          const dailyAppointments = appointments.filter(
            (apt: any) => apt.date.startsWith(formattedLoopDate) && apt.status === 'SCHEDULED'
          );
          const busyTimes = dailyAppointments.map((apt: any) => apt.startTime);

          const availableTimes = dayConfig.timeSlots.filter(
            (time: string) => !busyTimes.includes(time)
          );

          availableTimes.forEach((time: string) => {
            const [hours, minutes] = time.split(':');
            const startDateTime = new Date(loopDate);
            startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            const endDateTime = new Date(startDateTime);
            endDateTime.setHours(startDateTime.getHours() + 1);

            marks.push({
              id: `avail-${formattedLoopDate}-${time}`,
              title: 'Disponible',
              start: startDateTime,
              end: endDateTime,
              isAvailabilityMark: true,
            });
          });
        }
      }
      loopDate = addDays(loopDate, 1);
    }

    return marks;
  }, [businessHours, appointments, currentDate, closedDates, fullyBookedDays]);

  const formatDate = (date: string, time: string) => {
    try {
      // Si date contiene T, tomar solo la parte de la fecha
      const dateOnly = date.includes('T') ? date.split('T')[0] : date;
      const dateTime = parseISO(`${dateOnly}T${time}`);
      return format(dateTime, 'EEEE d MMMM yyyy - HH:mm', { locale: es });
    } catch {
      return 'Fecha no válida';
    }
  };

  // Función para validar si se puede cancelar una cita (debe tener más de 24 horas)
  const canCancelAppointment = (appointmentDate: string, startTime: string): boolean => {
    const appointmentDateTime = new Date(appointmentDate);
    const [hours, minutes] = startTime.split(':').map(Number);
    appointmentDateTime.setHours(hours, minutes, 0, 0);

    const now = new Date();
    const hoursUntilAppointment = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    return hoursUntilAppointment > 24;
  };

  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    const dateStr = format(slotInfo.start, 'yyyy-MM-dd');
    const isFullyBooked = fullyBookedDays.has(dateStr);
    
    if (isDayBlocked(slotInfo.start)) {
      toast('¡Día de descanso! Por favor, elige otra fecha para consentirte. 💅', {
        icon: '😴',
        style: {
          borderRadius: '10px',
          background: '#333',
          color: '#fff',
        },
      });
      return;
    }

    if (isFullyBooked) {
      toast('¡Día completamente ocupado! Todos los horarios están reservados. 💅', {
        icon: '😔',
        style: {
          borderRadius: '10px',
          background: '#e39000',
          color: '#fff',
        },
      });
      return;
    }

    const newDate = format(slotInfo.start, 'yyyy-MM-dd');
    const newStartTime = format(slotInfo.start, 'HH:mm');
    const newEndTime = format(slotInfo.end, 'HH:mm');

    setFormData({
      productId: '',
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
    });
    setShowForm(true);
  };

  const handleSelectAvailableSlot = (slotTime: string) => {
    // Asumir duración de 1 hora por defecto
    const [hours, minutes] = slotTime.split(':').map(Number);
    const endHour = hours + 1;
    const endTime = `${endHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    setFormData({
      ...formData,
      startTime: slotTime,
      endTime: endTime,
    });
  };

  // Función para verificar disponibilidad de un día y actualizar el estado
  const checkDayAvailability = async (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    try {
      const response = await api.get<string[]>(`/portal/available-slots?date=${dateStr}`);
      const isFullyBooked = response.data.length === 0;

      console.log(`Checking availability for ${dateStr}: ${response.data.length} slots available, fully booked: ${isFullyBooked}`);

      setFullyBookedDays(prev => {
        const newSet = new Set(prev);
        if (isFullyBooked) {
          newSet.add(dateStr);
          console.log(`Marked ${dateStr} as fully booked`);
        } else {
          newSet.delete(dateStr);
          console.log(`Removed ${dateStr} from fully booked (has available slots)`);
        }
        return newSet;
      });
    } catch (error) {
      console.error('Error checking day availability:', error);
    }
  };

  // Verificar disponibilidad cuando cambia la vista del calendario
  const handleNavigate = (newDate: Date) => {
    setCurrentDate(newDate);

    // Verificar disponibilidad de TODOS los días del mes nuevo
    checkAllDaysInMonth(newDate);
  };

  const handleViewChange = (newView: string) => {
    setCurrentView(newView);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    if (event.resource && !event.isAvailabilityMark) {
      setSelectedEventModal(event.resource);
    }
  };

  const handleCancelAppointmentClick = () => {
    if (!selectedEventModal) return;

    if (!canCancelAppointment(selectedEventModal.date, selectedEventModal.startTime)) {
      toast.error('Las citas deben ser canceladas con al menos 24 horas de anticipación');
      return;
    }

    setAppointmentToCancel(selectedEventModal);
  };

  const handleConfirmCancel = () => {
    if (appointmentToCancel) {
      cancelMutation.mutate(appointmentToCancel.id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.productId || !formData.date) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    // Inyectar automáticamente el clientId del usuario autenticado
    const appointmentData = {
      clientId: user?.id || '',
      productId: formData.productId,
      date: new Date(formData.date).toISOString(),
      startTime: formData.startTime,
      endTime: formData.endTime,
      notes: '',
    };

    if (!appointmentData.clientId) {
      toast.error('Error: No se pudo obtener tu ID de usuario');
      return;
    }

    createMutation.mutate(appointmentData);
  };

  const resetForm = () => {
    setFormData({
      productId: '',
      date: new Date().toISOString().split('T')[0],
      startTime: '10:00',
      endTime: '11:00',
    });
    setShowForm(false);
  };

  // Colorear eventos según el status y slots disponibles (eventos fantasma)
  const eventPropGetter = (event: any) => {
    if (event.isAvailabilityMark) {
      return {
        style: {
          backgroundColor: '#ecfdf5',
          border: '2px dashed #10b981',
          color: '#047857',
          pointerEvents: 'none',
          opacity: 0.8,
          borderRadius: '4px',
        },
      };
    }

    const status = event.resource?.status;

    let style = {
      backgroundColor: '#3b82f6',
      borderRadius: '5px',
      opacity: 0.8,
      color: 'white',
      border: '0px',
      display: 'block',
    };

    if (status === 'COMPLETED') {
      style.backgroundColor = '#10b981';
    } else if (status === 'CANCELLED') {
      style.backgroundColor = '#ef4444';
    }

    return { style };
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mis Citas</h1>
        <p className="text-gray-600 mt-2">Selecciona un espacio en el calendario para agendar tu próxima cita</p>
      </div>

      {/* Calendario */}
      <div className="bg-white rounded-lg shadow p-4">
        {appointmentsLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <DnDCalendar
            localizer={localizer}
            events={[...calendarEvents, ...availabilityMarks]}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 'calc(100vh - 400px)' }}
            selectable
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventPropGetter}
            dayPropGetter={customDayPropGetter}
            components={{
              month: {
                date: CustomDateCell,
              },
            }}
            resizable={false}
            popup
            culture="es"
            date={currentDate}
            onNavigate={handleNavigate}
            view={currentView as any}
            onView={handleViewChange}
            messages={{
              today: 'Hoy',
              previous: 'Anterior',
              next: 'Siguiente',
              month: 'Mes',
              week: 'Semana',
              day: 'Día',
              agenda: 'Agenda',
              date: 'Fecha',
              time: 'Hora',
              event: 'Evento',
              allDay: 'Todo el día',
              work_week: 'Semana Laboral',
              yesterday: 'Ayer',
              tomorrow: 'Mañana',
            }}
          />
        )}
      </div>

      {/* Próximas Citas */}
      {upcomingAppointments.length > 0 && !showForm && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Tus Próximas Citas</h2>
          <div className="space-y-4">
            {upcomingAppointments.map((appointment: Appointment) => (
              <div
                key={appointment.id}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {appointment.product?.name || 'Servicio'}
                    </h3>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center text-gray-600">
                        <Calendar className="h-5 w-5 mr-3 text-purple-600" />
                        {formatDate(appointment.date, appointment.startTime)}
                      </div>
                      {appointment.product?.price && (
                        <div className="text-sm font-medium text-gray-900">
                          💰 ${appointment.product.price.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ml-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      Agendada
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulario Simplificado - Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 transition-opacity flex items-center justify-center z-50 p-4">
          {/* Overlay clickeable */}
          <div className="absolute inset-0" onClick={resetForm} />

          {/* Modal */}
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Header Sticky con Gradiente */}
            <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Agendar Nueva Cita</h3>
              <button
                type="button"
                onClick={resetForm}
                className="text-blue-100 hover:text-white focus:outline-none transition"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Contenido del Formulario */}
            <div className="p-8 space-y-8">

              {/* Sección: Fecha Seleccionada */}
              <div className="pb-6 border-b border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Fecha de la Cita</h4>
                <input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  required
                />
              </div>

              {/* Sección: Horarios Disponibles */}
              <div className="pb-6 border-b border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Horarios Disponibles</h4>
                {slotsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600">Cargando horarios...</span>
                  </div>
                ) : availableSlots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                      {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => handleSelectAvailableSlot(slot)}
                        className={`flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                          formData.startTime === slot
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                        }`}
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        {slot}
                      </button>
                      ))}
                  </div>
                ) : isDayBlocked(new Date(formData.date)) ? (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">No hay horarios disponibles</p>
                    <p className="text-sm mt-1">Este día no está disponible</p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">No hay horarios disponibles</p>
                    <p className="text-sm mt-1">Intenta seleccionar otra fecha</p>
                  </div>
                )}
              </div>

              {/* Resumen: Horario Seleccionado */}
              {formData.startTime && (
                <div className="pb-6 border-b border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Horario Seleccionado</h4>
                  <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 rounded-lg border border-blue-200">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold text-blue-900">
                      {formData.startTime} - {formData.endTime}
                    </span>
                  </div>
                </div>
              )}

              {/* Sección: Seleccionar Servicio */}
              <form onSubmit={handleSubmit} className="pb-6 border-b border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Selecciona tu Servicio <span className="text-red-500">*</span></h4>
                <select
                  id="product"
                  value={formData.productId}
                  onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  autoFocus
                >
                  <option value="">-- Selecciona un servicio --</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - ${Number(product.price).toFixed(2)}
                    </option>
                  ))}
                </select>

                {/* Botonera Final */}
                <div className="flex justify-end gap-3 pt-6 mt-6">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {createMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Agendando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5" />
                        Confirmar Cita
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalles del Evento */}
      {selectedEventModal && !appointmentToCancel && (
        <div className="fixed inset-0 bg-black/50 transition-opacity flex items-center justify-center z-50 p-4">
          <div className="absolute inset-0" onClick={() => setSelectedEventModal(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="sticky top-0 z-10 bg-gradient-to-r from-purple-600 to-purple-700 px-8 py-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Detalles de tu Cita</h3>
              <button
                type="button"
                onClick={() => setSelectedEventModal(null)}
                className="text-white hover:text-purple-100 focus:outline-none"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              {/* Servicio */}
              <div className="border-b border-gray-200 pb-4">
                <p className="text-sm font-medium text-gray-500">Servicio</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {selectedEventModal.product?.name || 'Servicio'}
                </p>
              </div>

              {/* Fecha y Hora */}
              <div className="border-b border-gray-200 pb-4">
                <p className="text-sm font-medium text-gray-500">Fecha y Hora</p>
                <p className="text-lg font-semibold text-gray-900 mt-1 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  {formatDate(selectedEventModal.date, selectedEventModal.startTime)}
                </p>
              </div>

              {/* Precio */}
              {selectedEventModal.product?.price && (
                <div className="border-b border-gray-200 pb-4">
                  <p className="text-sm font-medium text-gray-500">Precio</p>
                  <p className="text-lg font-semibold text-purple-600 mt-1">
                    ${Number(selectedEventModal.product.price).toFixed(2)}
                  </p>
                </div>
              )}

              {/* Estado */}
              <div className="pb-6">
                <p className="text-sm font-medium text-gray-500">Estado</p>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-1 bg-blue-100 text-blue-800">
                  {selectedEventModal.status === 'SCHEDULED' && 'Agendada'}
                  {selectedEventModal.status === 'COMPLETED' && 'Completada'}
                  {selectedEventModal.status === 'CANCELLED' && 'Cancelada'}
                </span>
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setSelectedEventModal(null)}
                  className="flex-1 px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                >
                  Cerrar
                </button>
                {selectedEventModal.status === 'SCHEDULED' && (
                  <button
                    type="button"
                    onClick={handleCancelAppointmentClick}
                    disabled={cancelMutation.isPending}
                    className="flex-1 px-6 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cancelMutation.isPending ? 'Cancelando...' : 'Cancelar Cita'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Cancelación */}
      {appointmentToCancel && (
        <div className="fixed inset-0 bg-black/50 transition-opacity flex items-center justify-center z-50 p-4">
          <div className="absolute inset-0" onClick={() => setAppointmentToCancel(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-red-50 px-8 py-6">
              <h3 className="text-lg font-bold text-red-900">Confirmar Cancelación</h3>
              <p className="text-sm text-red-700 mt-2">
                ¿Deseas cancelar tu cita para {appointmentToCancel.product?.name}?
              </p>
            </div>

            <div className="p-8 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  Esta acción no se puede deshacer. Se enviará una notificación al salón sobre la cancelación.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Cita a Cancelar:</p>
                <p className="text-base font-semibold text-gray-900">
                  {appointmentToCancel.product?.name}
                </p>
                <p className="text-sm text-gray-600">
                  {formatDate(appointmentToCancel.date, appointmentToCancel.startTime)}
                </p>
              </div>
            </div>

            <div className="flex gap-3 px-8 py-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setAppointmentToCancel(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Mantener Cita
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelMutation.isPending}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelMutation.isPending ? 'Cancelando...' : 'Sí, Cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientAppointments;
