import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useClientAppointments, useClientProducts, useCreateClientAppointment, useAvailableSlots, useClosedDates } from '../../hooks/useQueries';
import { Calendar, CheckCircle, Clock } from 'lucide-react';
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
  resource: Appointment;
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
      const dateTime = parseISO(`${date}T${time}`);
      return format(dateTime, 'EEEE d MMMM yyyy - HH:mm', { locale: es });
    } catch {
      return 'Fecha no válida';
    }
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
          background: '#f59e0b',
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
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity duration-300"
              onClick={resetForm}
            />

            {/* Modal */}
            <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all duration-300 sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                
                {/* Header del Modal */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Agendar Nueva Cita
                  </h3>
                  <button
                    onClick={resetForm}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                  >
                    <span className="sr-only">Cerrar</span>
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Fecha Seleccionada */}
                <div className="mb-6">
                  <label htmlFor="date" className="block text-sm font-semibold text-gray-900">
                    Fecha de la Cita <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="mt-1 block w-full rounded-lg border border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 px-4 py-3"
                    required
                  />
                </div>

                {/* Slots Disponibles */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Horarios Disponibles
                  </label>
                  {slotsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                      <span className="ml-3 text-gray-600">Cargando horarios...</span>
                    </div>
                  ) : availableSlots.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => handleSelectAvailableSlot(slot)}
                          className={`flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                            formData.startTime === slot
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400 hover:bg-purple-50'
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
                      <p>No hay horarios disponibles para esta fecha</p>
                      <p className="text-sm mt-1">Este día no está disponible</p>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>No hay horarios disponibles para esta fecha</p>
                      <p className="text-sm mt-1">Intenta seleccionar otra fecha</p>
                    </div>
                  )}
                </div>

                {/* Hora Inicio y Fin - Solo mostrar si se seleccionó un slot */}
                {formData.startTime && (
                  <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-gray-600">Horario seleccionado:</p>
                    <p className="text-lg font-semibold text-green-600 mt-1">
                      {formData.startTime} - {formData.endTime}
                    </p>
                  </div>
                )}

                {/* Formulario */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Servicio - Campo Principal */}
                  <div>
                    <label htmlFor="product" className="block text-sm font-semibold text-gray-900">
                      Selecciona tu Servicio <span className="text-red-500">*</span>
                    </label>
                    <p className="text-sm text-gray-600 mt-1 mb-3">
                      Elige el servicio de manicura que deseas
                    </p>
                    <select
                      id="product"
                      value={formData.productId}
                      onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 px-4 py-3"
                      autoFocus
                    >
                      <option value="">-- Selecciona un servicio --</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} - ${Number(product.price).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Botones */}
                  <div className="flex gap-4 pt-6 border-t mt-8">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 inline-flex justify-center px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending}
                      className="flex-1 inline-flex justify-center items-center px-4 py-3 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-lg shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {createMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Agendando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-5 w-5" />
                          Confirmar Cita
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientAppointments;
