import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppointments, useClients, useProducts, useCreateAppointment, useUpdateAppointment, useDeleteAppointment, useClosedDates, useScheduleOverride, useUpsertScheduleOverride, useDeleteScheduleOverride } from '../hooks/useQueries';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, isBefore, startOfDay, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDay } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { api } from '../lib/api';

// Importaciones necesarias para el Drag and Drop
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

interface BusinessHour {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isOpen: boolean;
  timeSlots?: string[]; // slots horarios explícitos
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
  clientId: string;
  productId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
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

// Extraemos la función real en caso de que Vite la haya envuelto en un objeto 'default'
const withDragAndDropFn = (withDragAndDrop as any).default || withDragAndDrop;

// Envolver el calendario usando la función extraída
const DnDCalendar = withDragAndDropFn(Calendar as any);

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

// Función auxiliar para validar si una hora está dentro del horario comercial
const isTimeWithinBusinessHours = (
  date: Date,
  startTime: string,
  endTime: string,
  businessHours: BusinessHour[]
): boolean => {
  const dayOfWeek = date.getDay();
  const businessHour = businessHours.find((bh) => bh.dayOfWeek === dayOfWeek);

  if (!businessHour || !businessHour.isOpen) {
    return false;
  }

  const [reqStartHour, reqStartMin] = startTime.split(':').map(Number);
  const [reqEndHour, reqEndMin] = endTime.split(':').map(Number);
  const [shopStartHour, shopStartMin] = businessHour.startTime.split(':').map(Number);
  const [shopEndHour, shopEndMin] = businessHour.endTime.split(':').map(Number);

  const reqStartMinutes = reqStartHour * 60 + reqStartMin;
  const reqEndMinutes = reqEndHour * 60 + reqEndMin;
  const shopStartMinutes = shopStartHour * 60 + shopStartMin;
  const shopEndMinutes = shopEndHour * 60 + shopEndMin;

  return reqStartMinutes >= shopStartMinutes && reqEndMinutes <= shopEndMinutes;
};

// Función para verificar si una fecha específica está bloqueada
const isSpecificClosedDay = (date: Date, closedDates: any[]): boolean => {
  const dateStr = format(date, 'yyyy-MM-dd');
  return closedDates.some(cd => cd.date === dateStr);
};

// Función para verificar si un día está disponible (no es pasado, no está cerrado, y tiene horario comercial)
const isDayAvailable = (date: Date, closedDates: any[], businessHours: BusinessHour[]): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Verificar si es una fecha pasada
  if (date < today) {
    return false;
  }

  // Verificar si es un día cerrado específico
  if (isSpecificClosedDay(date, closedDates)) {
    return false;
  }

  // Verificar si el día de la semana tiene horario comercial configurado y está abierto
  const dayOfWeek = date.getDay();
  const businessHour = businessHours.find((bh) => bh.dayOfWeek === dayOfWeek);

  // Si no hay horario comercial configurado para este día, o está cerrado, no está disponible
  if (!businessHour || !businessHour.isOpen) {
    return false;
  }

  return true;
};

// Función para propiedades personalizadas del día en el calendario
const customDayPropGetter = (date: Date, closedDates: any[], businessHours: BusinessHour[], fullyBookedDays: Set<string>) => {
  const isAvailable = isDayAvailable(date, closedDates, businessHours);
  const dateStr = format(date, 'yyyy-MM-dd');
  const isFullyBooked = fullyBookedDays.has(dateStr);

  if (!isAvailable) {
    return {
      style: {
        backgroundColor: 'rgb(171, 175, 182)',
        cursor: 'not-allowed',
        opacity: 0.8,
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

  return {
    style: {},
  };
};

// Función para verificar disponibilidad de un día específico
const checkDayAvailability = async (date: Date, setFullyBookedDays: React.Dispatch<React.SetStateAction<Set<string>>>) => {
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

// Función para verificar disponibilidad de todos los días del mes actual
const checkAllDaysInMonth = async (monthDate: Date, closedDates: any[], businessHours: BusinessHour[], setFullyBookedDays: React.Dispatch<React.SetStateAction<Set<string>>>) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  // Obtener el último día del mes
  const lastDay = new Date(year, month + 1, 0);
  const totalDays = lastDay.getDate();

  // Crear array de promesas para verificar cada día en paralelo
  const promises = [];
  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, month, day);
    // Solo verificar días que están disponibles (no bloqueados)
    if (isDayAvailable(date, closedDates, businessHours)) {
      promises.push(checkDayAvailability(date, setFullyBookedDays));
    }
  }

  // Ejecutar todas las verificaciones en paralelo
  await Promise.all(promises);
};

const Appointments: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState('month');
  const [fullyBookedDays, setFullyBookedDays] = useState<Set<string>>(new Set());

  // Estados para pestañas del modal
  const [activeTab, setActiveTab] = useState<'appointment' | 'schedule'>('appointment');

  // Estados para gestión de schedule overrides
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [overrideTimeSlots, setOverrideTimeSlots] = useState<string[]>([]);
  const [newSlotInput, setNewSlotInput] = useState<string>('');

  const [formData, setFormData] = useState<FormData>({
    clientId: '',
    productId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '11:00',
    notes: '',
    status: 'SCHEDULED',
  });

  // Hooks
  const { data: appointments = [], isLoading: appointmentsLoading } = useAppointments();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: businessHours = [], isLoading: businessHoursLoading } = useBusinessHours();
  const { data: closedDates = [], isLoading: closedDatesLoading } = useClosedDates();

  // Hooks para schedule overrides
  const { data: scheduleOverride, isLoading: overrideLoading } = useScheduleOverride(selectedDate);
  const upsertOverrideMutation = useUpsertScheduleOverride({
    onSuccess: () => {
      toast.success('Excepción de horario guardada correctamente');
      setActiveTab('appointment');
    },
  });
  const deleteOverrideMutation = useDeleteScheduleOverride({
    onSuccess: () => {
      toast.success('Horario restaurado al estado normal');
      setOverrideTimeSlots([]);
    },
  });

  // Inicializar timeSlots cuando se carga un override
  React.useEffect(() => {
    if (scheduleOverride) {
      setOverrideTimeSlots(scheduleOverride.timeSlots || []);
    } else if (selectedDate) {
      // Si no hay override, mostrar los slots por defecto del día de semana
      const dateObj = new Date(selectedDate + 'T00:00:00');
      const dayOfWeek = dateObj.getDay();
      const dayConfig = businessHours.find(bh => bh.dayOfWeek === dayOfWeek);
      setOverrideTimeSlots(dayConfig?.timeSlots || []);
    }
  }, [scheduleOverride, selectedDate, businessHours]);

  const createMutation = useCreateAppointment({
    onSuccess: () => {
      toast.success('Cita creada correctamente');
      closeModal();
    },
  });

  const updateMutation = useUpdateAppointment({
    onSuccess: () => {
      toast.success('Cita actualizada correctamente');
      closeModal();
    },
  });

  const deleteMutation = useDeleteAppointment({
    onSuccess: () => {
      toast.success('Cita eliminada correctamente');
      setItemToDelete(null);
      closeModal();
    },
  });

  // Verificar disponibilidad cuando se crea una nueva cita
  React.useEffect(() => {
    if (createMutation.isSuccess) {
      // Re-verificar la disponibilidad del día de la cita creada
      const appointmentDate = new Date(formData.date);
      checkDayAvailability(appointmentDate, setFullyBookedDays);
    }
  }, [createMutation.isSuccess]);

  // Verificar disponibilidad cuando se actualiza una cita
  React.useEffect(() => {
    if (updateMutation.isSuccess && editingAppointment) {
      // Re-verificar la disponibilidad del día de la cita actualizada
      const appointmentDate = new Date(editingAppointment.date);
      checkDayAvailability(appointmentDate, setFullyBookedDays);
    }
  }, [updateMutation.isSuccess, editingAppointment]);

  // Verificar disponibilidad cuando se elimina una cita
  React.useEffect(() => {
    if (deleteMutation.isSuccess && itemToDelete) {
      // Encontrar la cita eliminada para re-verificar su día
      const deletedAppointment = appointments.find(apt => apt.id === itemToDelete);
      if (deletedAppointment) {
        const appointmentDate = new Date(deletedAppointment.date);
        checkDayAvailability(appointmentDate, setFullyBookedDays);
      }
    }
  }, [deleteMutation.isSuccess, itemToDelete, appointments]);

  // Verificar disponibilidad inicial cuando se cargan los datos
  React.useEffect(() => {
    if (businessHours.length > 0 && closedDates.length >= 0) {
      checkAllDaysInMonth(currentDate, closedDates, businessHours, setFullyBookedDays);
    }
  }, [businessHours, closedDates, currentDate]);

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

  // Eventos fantasma de slots disponibles
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

      if (!isPast && !isSunday && !isSpecificClosed) {
        const dayOfWeek = loopDate.getDay();
        const dayConfig = businessHours.find((bh: any) => bh.dayOfWeek === dayOfWeek);

        if (dayConfig && dayConfig.isOpen && dayConfig.timeSlots && dayConfig.timeSlots.length > 0) {
          const timeSlots = dayConfig.timeSlots;
          const dailyAppointments = appointments.filter(
            (apt: any) => apt.date.startsWith(formattedLoopDate) && apt.status === 'SCHEDULED'
          );
          const busyTimes = dailyAppointments.map((apt: any) => apt.startTime);

          const availableTimes = timeSlots.filter(
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
  }, [businessHours, appointments, currentDate, closedDates]);

  // Componente personalizado para las celdas de fecha en el calendario
  const CustomDateCell = ({ date, label }: { date: Date; label: string }) => {
    const isAvailable = isDayAvailable(date, closedDates, businessHours);
    const dateStr = format(date, 'yyyy-MM-dd');
    const isFullyBooked = fullyBookedDays.has(dateStr);

    return (
      <div className="flex flex-col items-center justify-center h-full">
        <span>{label}</span>
        {!isAvailable && <span className="text-xs text-red-600 font-medium">No Disponible</span>}
        {isFullyBooked && isAvailable && <span className="text-xs text-orange-700 font-medium">Completo</span>}
      </div>
    );
  };

  // Funciones de Modal
  const openModal = (appointment?: Appointment, slotStart?: Date, slotEnd?: Date) => {
    if (appointment) {
      setEditingAppointment(appointment);
      setFormData({
        clientId: appointment.clientId,
        productId: appointment.productId,
        date: appointment.date.split('T')[0],
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        notes: appointment.notes || '',
        status: appointment.status,
      });
      setSelectedDate(appointment.date.split('T')[0]);
    } else {
      setEditingAppointment(null);
      let newDate = new Date().toISOString().split('T')[0];
      let newStartTime = '10:00';
      let newEndTime = '11:00';

      if (slotStart && slotEnd) {
        newDate = format(slotStart, 'yyyy-MM-dd');
        newStartTime = format(slotStart, 'HH:mm');
        newEndTime = format(slotEnd, 'HH:mm');
        setSelectedDate(newDate);
      }

      setFormData({
        clientId: '',
        productId: '',
        date: newDate,
        startTime: newStartTime,
        endTime: newEndTime,
        notes: '',
        status: 'SCHEDULED',
      });
    }
    setActiveTab('appointment');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAppointment(null);
    setActiveTab('appointment');
    setSelectedDate('');
    setOverrideTimeSlots([]);
    setNewSlotInput('');
  };

  // Funciones para gestión de schedule overrides
  const sortTimeSlots = (slots: string[]) =>
    [...slots].slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const handleAddTimeSlot = () => {
    const slotValue = newSlotInput.trim();
    if (!slotValue) return;

    const slotFormat = /^\d{2}:\d{2}$/;
    if (!slotFormat.test(slotValue)) {
      toast.error('El slot debe tener formato HH:mm');
      return;
    }

    if (overrideTimeSlots.includes(slotValue)) {
      toast.error('El slot ya existe');
      return;
    }

    const updatedSlots = sortTimeSlots([...overrideTimeSlots, slotValue]);
    setOverrideTimeSlots(updatedSlots);
    setNewSlotInput('');
  };

  const handleRemoveTimeSlot = (slot: string) => {
    const updatedSlots = overrideTimeSlots.filter(ts => ts !== slot);
    setOverrideTimeSlots(updatedSlots);
  };

  const handleSaveScheduleOverride = () => {
    if (!selectedDate) return;

    upsertOverrideMutation.mutate({
      date: selectedDate,
      timeSlots: overrideTimeSlots,
    });
  };

  const handleRestoreDefaultSchedule = () => {
    if (!selectedDate) return;

    deleteOverrideMutation.mutate(selectedDate);
  };

  // Funciones de Formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.clientId || !formData.productId) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    // Validar que las horas seleccionadas estén dentro del horario comercial
    const appointmentDate = new Date(formData.date);
    if (!isTimeWithinBusinessHours(appointmentDate, formData.startTime, formData.endTime, businessHours)) {
      toast.error('Las horas seleccionadas están fuera del horario comercial');
      return;
    }

    const appointmentData = {
      ...formData,
      date: new Date(formData.date).toISOString(),
    };

    if (editingAppointment) {
      updateMutation.mutate({
        id: editingAppointment.id,
        appointmentData,
      });
    } else {
      createMutation.mutate(appointmentData);
    }
  };

  // Funciones de Acciones
  const handleDeleteAppointment = (id: string) => {
    deleteMutation.mutate(id);
  };

  // Colorear eventos según el status y slots disponibles (eventos fantasma)
  const eventPropGetter = (event: any) => {
    if (event.isAvailabilityMark) {
      return {
        style: {
          backgroundColor: '#ecfdf5', // verde muy claro
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
      backgroundColor: '#3b82f6', // Azul por defecto (SCHEDULED)
      borderRadius: '5px',
      opacity: 0.8,
      color: 'white',
      border: '0px',
      display: 'block',
    };

    if (status === 'COMPLETED') {
      style.backgroundColor = '#10b981'; // Verde
    } else if (status === 'CANCELLED') {
      style.backgroundColor = '#ef4444'; // Rojo
    }

    return { style };
  };

  // Manejadores del calendario
  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    // Verificar si el día está disponible (no es pasado, no está cerrado, y tiene horario comercial)
    if (!isDayAvailable(slotInfo.start, closedDates, businessHours)) {
      toast.error('Este día no está disponible para agendar');
      return;
    }

    // Nota: La validación de horas específicas se hace en el formulario cuando el usuario ingresa las horas
    openModal(undefined, slotInfo.start, slotInfo.end);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    openModal(event.resource);
  };

  const handleNavigate = (newDate: Date) => {
    setCurrentDate(newDate);

    // Verificar disponibilidad de TODOS los días del mes nuevo
    checkAllDaysInMonth(newDate, closedDates, businessHours, setFullyBookedDays);
  };

  const handleViewChange = (newView: string) => {
    setCurrentView(newView);
  };

  // Función que maneja cuando se suelta el evento arrastrado (Tipado corregido)
  const handleEventDrop = async ({ event, start, end }: { event: CalendarEvent; start: string | Date; end: string | Date }) => {
    const appointment = event.resource;
    
    const newStart = new Date(start);
    const newEnd = new Date(end);

    if (!newStart || !newEnd) {
      toast.error('Error al mover la cita');
      return;
    }

    // Validar que las nuevas horas estén dentro del horario comercial
    const startTimeStr = format(newStart, 'HH:mm');
    const endTimeStr = format(newEnd, 'HH:mm');
    if (!isTimeWithinBusinessHours(newStart, startTimeStr, endTimeStr, businessHours)) {
      toast.error('No se puede mover la cita a un horario fuera de servicio');
      return;
    }

    try {
      const updatedAppointment = {
        clientId: appointment.clientId,
        productId: appointment.productId,
        date: newStart.toISOString(),
        startTime: startTimeStr,
        endTime: endTimeStr,
        notes: appointment.notes || '',
        status: appointment.status,
      };

      updateMutation.mutate({
        id: appointment.id,
        appointmentData: updatedAppointment,
      });
    } catch (error) {
      toast.error('Error al actualizar la cita');
    }
  };

  const isLoading = appointmentsLoading || clientsLoading || productsLoading || businessHoursLoading || closedDatesLoading;

  // Calcular el rango de horas del calendario basado en los horarios comerciales
  const calendarMinMax = useMemo(() => {
    if (businessHours.length === 0) {
      // Horario por defecto si no hay datos
      const defaultMin = new Date();
      const defaultMax = new Date();
      defaultMin.setHours(8, 0, 0, 0);
      defaultMax.setHours(20, 0, 0, 0);
      return { min: defaultMin, max: defaultMax };
    }

    // Encontrar la hora de apertura más temprana y la de cierre más tarde
    let earliestStart = '23:59';
    let latestEnd = '00:00';

    businessHours.forEach((bh) => {
      if (bh.isOpen) {
        if (bh.startTime < earliestStart) {
          earliestStart = bh.startTime;
        }
        if (bh.endTime > latestEnd) {
          latestEnd = bh.endTime;
        }
      }
    });

    const min = new Date();
    const max = new Date();

    const [startHour, startMin] = earliestStart.split(':').map(Number);
    const [endHour, endMin] = latestEnd.split(':').map(Number);

    min.setHours(Math.max(0, startHour - 1), startMin, 0, 0);
    max.setHours(Math.min(23, endHour + 1), endMin, 0, 0);

    return { min, max };
  }, [businessHours]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Agenda de Citas
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona todas las citas del salón de belleza - Haz clic en un espacio para crear, en un evento para editarlo, o arrástralo para cambiar su hora.
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <button
            onClick={() => openModal()}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="mr-2 h-5 w-5" />
            Nueva Cita
          </button>
        </div>
      </div>

      {/* Calendario */}
      <div className="bg-white rounded-lg shadow p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <DnDCalendar
            localizer={localizer}
            events={[...calendarEvents, ...availabilityMarks]}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 'calc(100vh - 200px)' }}
            selectable
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            onEventDrop={handleEventDrop}
            eventPropGetter={eventPropGetter}
            dayPropGetter={(date: Date) => customDayPropGetter(date, closedDates, businessHours, fullyBookedDays)}
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
            min={calendarMinMax.min}
            max={calendarMinMax.max}
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

      {/* Modal - Crear/Editar Cita */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity duration-300"
              onClick={closeModal}
            />

            {/* Modal */}
            <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all duration-300 sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                
                {/* Header del Modal con Pestañas */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Gestión del Día: {selectedDate ? format(new Date(selectedDate), 'dd/MM/yyyy', { locale: es }) : ''}
                    </h3>
                    <button
                      onClick={closeModal}
                      className="text-gray-400 hover:text-gray-500 focus:outline-none"
                    >
                      <span className="sr-only">Cerrar</span>
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Pestañas */}
                  <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                      <button
                        onClick={() => setActiveTab('appointment')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                          activeTab === 'appointment'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Agendar Cita
                      </button>
                      <button
                        onClick={() => setActiveTab('schedule')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                          activeTab === 'schedule'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Gestionar Horario del Día
                      </button>
                    </nav>
                  </div>
                </div>

                {/* Contenido del Modal */}
                {activeTab === 'appointment' ? (
                  /* Formulario de Cita */
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="client" className="block text-sm font-medium text-gray-700">
                        Clienta <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="client"
                        value={formData.clientId}
                        onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border px-3 py-2"
                      >
                        <option value="">-- Selecciona una clienta --</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name} ({client.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Servicio */}
                    <div>
                      <label htmlFor="product" className="block text-sm font-medium text-gray-700">
                        Servicio <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="product"
                        value={formData.productId}
                        onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border px-3 py-2"
                      >
                        <option value="">-- Selecciona un servicio --</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} (${Number(product.price).toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Fecha */}
                    <div>
                      <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                        Fecha de la Cita <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border px-3 py-2"
                        required
                      />
                    </div>

                    {/* Hora Inicio */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="startTime" className="block text-sm font-medium text-gray-700">
                          Hora de Inicio <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="startTime"
                          type="time"
                          value={formData.startTime}
                          onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border px-3 py-2"
                          required
                        />
                      </div>

                      {/* Hora Fin */}
                      <div>
                        <label htmlFor="endTime" className="block text-sm font-medium text-gray-700">
                          Hora de Fin <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="endTime"
                          type="time"
                          value={formData.endTime}
                          onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border px-3 py-2"
                          required
                        />
                      </div>
                    </div>

                    {/* Notas */}
                    <div>
                      <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                        Notas (opcional)
                      </label>
                      <textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border px-3 py-2"
                        placeholder="Ej: Cliente prefiere lado izquierdo, alergia a ciertos productos..."
                      />
                    </div>

                    {/* Estado */}
                    <div>
                      <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                        Estado <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="status"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border px-3 py-2"
                      >
                        <option value="SCHEDULED">Agendada</option>
                        <option value="COMPLETED">Completada</option>
                        <option value="CANCELLED">Cancelada</option>
                      </select>
                    </div>

                    {/* Botones */}
                    <div className="flex justify-between gap-3 pt-6 border-t mt-6">
                      {/* Botón de eliminar, solo si estamos editando */}
                      {editingAppointment ? (
                        <button
                          type="button"
                          onClick={() => setItemToDelete(editingAppointment.id)}
                          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-red-700 bg-red-100 border border-transparent rounded-md shadow-sm hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar
                        </button>
                      ) : (
                        <div></div>
                      )}

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={closeModal}
                          className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={createMutation.isPending || updateMutation.isPending}
                          className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {(createMutation.isPending || updateMutation.isPending) ? 'Guardando...' : 'Guardar Cita'}
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  /* Gestión de Horario del Día */
                  <div className="space-y-4">
                    {overrideLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    ) : (
                      <>
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="ml-3">
                              <h3 className="text-sm font-medium text-blue-800">
                                {scheduleOverride ? 'Horario Personalizado' : 'Horario General'}
                              </h3>
                              <div className="mt-2 text-sm text-blue-700">
                                <p>
                                  {scheduleOverride
                                    ? 'Este día tiene una excepción de horario personalizada.'
                                    : 'Este día usa el horario general configurado. Haz clic en "Modificar" para crear una excepción.'
                                  }
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Time Slots Management */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Horarios disponibles para este día
                          </label>
                          <div className="flex gap-2 items-center mb-3">
                            <input
                              type="time"
                              value={newSlotInput}
                              onChange={(e) => setNewSlotInput(e.target.value)}
                              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border px-3 py-2"
                            />
                            <button
                              onClick={handleAddTimeSlot}
                              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                              +
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-gray-500 mb-3">
                            Agrega horarios específicos para este día. Se ordenarán automáticamente.
                          </p>

                          <div className="flex flex-wrap gap-2">
                            {sortTimeSlots(overrideTimeSlots).map((slot) => (
                              <span
                                key={slot}
                                className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 text-xs px-2 py-1"
                              >
                                {slot}
                                <button
                                  onClick={() => handleRemoveTimeSlot(slot)}
                                  className="ml-1 text-blue-800 hover:text-blue-900"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Botones de Acción */}
                        <div className="flex justify-between gap-3 pt-6 border-t mt-6">
                          {scheduleOverride && (
                            <button
                              type="button"
                              onClick={handleRestoreDefaultSchedule}
                              disabled={deleteOverrideMutation.isPending}
                              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-red-700 bg-red-100 border border-transparent rounded-md shadow-sm hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                            >
                              {deleteOverrideMutation.isPending ? 'Restaurando...' : 'Restaurar Horario Normal'}
                            </button>
                          )}
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => setActiveTab('appointment')}
                              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              Volver
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveScheduleOverride}
                              disabled={upsertOverrideMutation.isPending}
                              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {upsertOverrideMutation.isPending ? 'Guardando...' : 'Guardar Excepción'}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={itemToDelete !== null}
        title="Eliminar Cita"
        message="¿Estás seguro que deseas eliminar esta cita? Esta acción no se puede deshacer."
        onConfirm={() => itemToDelete && handleDeleteAppointment(itemToDelete)}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
};

export default Appointments;