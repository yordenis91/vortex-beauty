import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppointments, useClients, useServices, useProfessionals, useCreateAppointment, useUpdateAppointment, useDeleteAppointment, useBookingSettings, useClosedDates, useFullyBookedDates, useAdminSlots, useScheduleOverride, useUpsertScheduleOverride, useDeleteScheduleOverride } from '../hooks/useQueries';
import { Plus, Trash2, Clock, User, Package, Calendar as CalendarIcon, Edit, AlertCircle, UserCog } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import { format, isBefore, startOfDay, startOfMonth, endOfMonth, eachDayOfInterval, addMonths } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { api } from '../lib/api';
import type { Appointment, AppointmentStatus } from '../types';
import { canManage } from '../types';
import { useAuth } from '../contexts/AuthContext';
import WeekAgenda from '../components/WeekAgenda';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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


interface FormData {
  clientId: string;
  serviceId: string;
  professionalId: string;
  date: string;
  startTime: string;
  notes: string;
  status: AppointmentStatus;
}

interface ClosedDate {
  id: string;
  date: string;
  reason?: string;
}

const parseDateString = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const isSpecificClosedDay = (date: Date, closedDates: ClosedDate[]): boolean => {
  const dateStr = format(date, 'yyyy-MM-dd');
  return closedDates.some((cd) => cd.date === dateStr);
};

const isDayAvailable = (
  date: Date,
  closedDates: ClosedDate[],
  businessHours: BusinessHour[]
): boolean => {
  if (isBefore(startOfDay(date), startOfDay(new Date()))) {
    return false;
  }

  if (isSpecificClosedDay(date, closedDates)) {
    return false;
  }

  const dayOfWeek = date.getDay();
  const businessHour = businessHours.find((bh) => bh.dayOfWeek === dayOfWeek);

  if (!businessHour || !businessHour.isOpen) {
    return false;
  }

  return true;
};

const isDayFullyBooked = (date: Date, fullyBookedDates: string[]): boolean => {
  return fullyBookedDates.includes(format(date, 'yyyy-MM-dd'));
};

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

const timeToMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const STATUS_STYLES: Record<AppointmentStatus, { label: string; border: string; badge: string }> = {
  PENDING: { label: 'Pendiente', border: '#f59e0b', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  SCHEDULED: { label: 'Agendada', border: '#3b82f6', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  COMPLETED: { label: 'Completada', border: '#10b981', badge: 'bg-green-50 text-green-700 border-green-200' },
  CANCELLED: { label: 'Cancelada', border: '#ef4444', badge: 'bg-red-50 text-red-700 border-red-200' },
  NO_SHOW: { label: 'No asistió', border: '#6b7280', badge: 'bg-muted text-muted-foreground border-border' },
};

const Appointments: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [visibleMonth, setVisibleMonth] = useState(new Date());

  // Estados para pestañas del modal
  const [activeTab, setActiveTab] = useState<'appointment' | 'schedule'>('appointment');

  // Estados para gestión de schedule overrides
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [overrideTimeSlots, setOverrideTimeSlots] = useState<string[]>([]);
  const [newSlotInput, setNewSlotInput] = useState<string>('');

  const [formData, setFormData] = useState<FormData>({
    clientId: '',
    serviceId: '',
    professionalId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    notes: '',
    status: 'SCHEDULED',
  });

  const { role } = useAuth();
  const isManager = canManage(role);
  // Vista: el día con su lista y huecos, o la semana con arrastre para reprogramar
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [calendarView, setCalendarView] = useState<'week' | 'day'>('week');
  // Selección para ver huecos libres y filtro de la agenda por profesional
  const [slotServiceId, setSlotServiceId] = useState('');
  const [slotProfessionalId, setSlotProfessionalId] = useState('any');
  const [agendaProfessionalId, setAgendaProfessionalId] = useState('');

  // Hooks
  // Solo se piden las citas del mes visible y el seleccionado (± 1 mes)
  const appointmentRange = useMemo(() => {
    const first = isBefore(visibleMonth, currentDate) ? visibleMonth : currentDate;
    const last = isBefore(visibleMonth, currentDate) ? currentDate : visibleMonth;
    return {
      from: format(startOfMonth(addMonths(first, -1)), 'yyyy-MM-dd'),
      to: format(endOfMonth(addMonths(last, 1)), 'yyyy-MM-dd'),
    };
  }, [visibleMonth, currentDate]);
  const { data: appointments = [], isLoading: appointmentsLoading } = useAppointments(appointmentRange);
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: services = [], isLoading: servicesLoading } = useServices();
  const { data: professionalList = [] } = useProfessionals(true);
  const { data: businessHours = [], isLoading: businessHoursLoading } = useBusinessHours();
  const { data: bookingSettings } = useBookingSettings();
  const { data: closedDates = [], isLoading: closedDatesLoading } = useClosedDates();
  const { data: fullyBookedDates = [], isLoading: fullyBookedLoading } = useFullyBookedDates();

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

  const selectedDateStr = format(currentDate, 'yyyy-MM-dd');
  const canShowAvailableSlots = isDayAvailable(currentDate, closedDates, businessHours);
  const effectiveSlotServiceId = slotServiceId || services.find((svc) => svc.status === 'ACTIVE')?.id || '';
  const { data: availableSlots = [], isLoading: slotsLoading } = useAdminSlots(
    canShowAvailableSlots ? selectedDateStr : '',
    effectiveSlotServiceId,
    slotProfessionalId
  );

  // Horas libres para el formulario (incluye la hora actual de la cita que se edita)
  const { data: modalSlots = [], isLoading: modalSlotsLoading } = useAdminSlots(
    showModal && activeTab === 'appointment' ? formData.date : '',
    formData.serviceId,
    formData.professionalId || 'any',
    editingAppointment?.id
  );
  const modalStartTimes = useMemo(() => {
    const times = new Set(modalSlots.map((slot) => slot.startTime));
    if (formData.startTime && editingAppointment && formData.date === editingAppointment.date.split('T')[0]) {
      times.add(editingAppointment.startTime);
    }
    return [...times].sort();
  }, [modalSlots, formData.startTime, formData.date, editingAppointment]);

  const dailyAppointments = useMemo(() => {
    return appointments
      .filter((apt) => apt.date.split('T')[0] === selectedDateStr)
      .filter((apt) => !agendaProfessionalId || apt.professionalId === agendaProfessionalId)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [appointments, selectedDateStr, agendaProfessionalId]);

  const appointmentDays = useMemo(() => {
    const uniqueDates = new Set(
      appointments.map((apt) => apt.date.split('T')[0])
    );
    return Array.from(uniqueDates).map(parseDateString);
  }, [appointments]);

  const unavailableDays = useMemo(() => {
    if (!businessHours.length) return [];

    return eachDayOfInterval({
      start: startOfMonth(visibleMonth),
      end: endOfMonth(visibleMonth),
    }).filter((date) => !isDayAvailable(date, closedDates, businessHours));
  }, [visibleMonth, closedDates, businessHours]);

  const fullyBookedDays = useMemo(
    () => fullyBookedDates.map(parseDateString),
    [fullyBookedDates]
  );

  const selectedDayStatus = useMemo(() => {
    if (isBefore(startOfDay(currentDate), startOfDay(new Date()))) {
      return { label: 'Día pasado', variant: 'past' as const };
    }
    if (!isDayAvailable(currentDate, closedDates, businessHours)) {
      return { label: 'No disponible', variant: 'unavailable' as const };
    }
    if (isDayFullyBooked(currentDate, fullyBookedDates)) {
      return { label: 'Completo', variant: 'full' as const };
    }
    return { label: 'Disponible', variant: 'available' as const };
  }, [currentDate, closedDates, businessHours, fullyBookedDates]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setCurrentDate(date);
    }
  };

  const validateDayForBooking = (date: Date): boolean => {
    if (!isDayAvailable(date, closedDates, businessHours)) {
      toast.error('Este día no está disponible para agendar');
      return false;
    }
    return true;
  };

  const handleSlotClick = (slot: { startTime: string; professionalIds: string[] }) => {
    openModal(undefined, {
      date: selectedDateStr,
      startTime: slot.startTime,
      serviceId: effectiveSlotServiceId,
      professionalId: slotProfessionalId !== 'any' ? slotProfessionalId : '',
    });
  };

  // Funciones de Modal
  const openModal = (
    appointment?: Appointment,
    preset?: { date: string; startTime: string; serviceId: string; professionalId: string }
  ) => {
    if (appointment) {
      setEditingAppointment(appointment);
      setFormData({
        clientId: appointment.clientId,
        serviceId: appointment.serviceId,
        professionalId: appointment.professionalId || '',
        date: appointment.date.split('T')[0],
        startTime: appointment.startTime,
        notes: appointment.notes || '',
        status: appointment.status,
      });
      setSelectedDate(appointment.date.split('T')[0]);
    } else {
      setEditingAppointment(null);
      const newDate = preset?.date ?? format(currentDate, 'yyyy-MM-dd');

      const targetDate = parseDateString(newDate);
      if (!validateDayForBooking(targetDate)) {
        return;
      }

      if (isDayFullyBooked(targetDate, fullyBookedDates)) {
        toast('Este día está completamente reservado. Como admin puedes agendar igualmente.', { icon: '⚠️' });
      }

      setSelectedDate(newDate);

      setFormData({
        clientId: '',
        serviceId: preset?.serviceId ?? '',
        professionalId: preset?.professionalId ?? '',
        date: newDate,
        startTime: preset?.startTime ?? '',
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

    if (!formData.clientId || !formData.serviceId || !formData.startTime) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }
    if (!modalStartTimes.includes(formData.startTime)) {
      toast.error('Esa hora ya no está disponible. Elige otra.');
      return;
    }

    const appointmentDate = parseDateString(formData.date);
    if (!editingAppointment && !validateDayForBooking(appointmentDate)) {
      return;
    }

    // La disponibilidad (horario, profesional, solapes) la valida el servidor.
    const appointmentData = {
      clientId: formData.clientId,
      serviceId: formData.serviceId,
      date: new Date(formData.date).toISOString(),
      startTime: formData.startTime,
      professionalId: formData.professionalId || 'any',
      notes: formData.notes,
      status: formData.status,
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

  // Cambio rápido de estado desde la tarjeta de la agenda
  const quickStatus = (appointment: Appointment, status: AppointmentStatus) => {
    if (status === 'CANCELLED' && !window.confirm('¿Cancelar esta cita? Se avisará al cliente.')) return;
    updateMutation.mutate({ id: appointment.id, appointmentData: { status } });
  };

  // Funciones de Acciones
  const handleDeleteAppointment = (id: string) => {
    deleteMutation.mutate(id);
  };

  // Jornada visible en la semana: de la primera apertura al último cierre (con holgura)
  const weekHours = useMemo(() => {
    const open = businessHours.filter((bh) => bh.isOpen);
    if (!open.length) return { from: '08:00', to: '20:00' };
    const earliest = Math.min(...open.map((bh) => timeToMinutes(bh.startTime)));
    const latest = Math.max(...open.map((bh) => timeToMinutes(bh.endTime)));
    const pad = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
    return { from: pad(Math.max(0, earliest - 60)), to: pad(Math.min(24 * 60 - 1, latest + 60)) };
  }, [businessHours]);

  const weekEvents = useMemo(
    () => appointments.filter((apt) => !agendaProfessionalId || apt.professionalId === agendaProfessionalId),
    [appointments, agendaProfessionalId]
  );

  // Arrastrar una cita: mismo servicio y profesional, nuevo día/hora. El servidor valida
  // disponibilidad; si no cabe, la cita vuelve a su sitio y se muestra el motivo.
  const handleMoveAppointment = (appointment: Appointment, dateStr: string, startTime: string) => {
    if (appointment.date.split('T')[0] === dateStr && appointment.startTime === startTime) return;
    updateMutation.mutate({
      id: appointment.id,
      appointmentData: { date: `${dateStr}T00:00:00.000Z`, startTime },
    });
  };

  const isLoading = appointmentsLoading || clientsLoading || servicesLoading || businessHoursLoading || closedDatesLoading || fullyBookedLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
            Agenda de Citas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona todas las citas del salón de belleza — selecciona un día en el calendario para ver la agenda y editar citas.
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4 gap-3">
          <div role="group" aria-label="Vista de la agenda" className="inline-flex rounded-md border border-border overflow-hidden">
            {(['day', 'week'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                aria-pressed={viewMode === mode}
                className={`px-4 py-2 text-sm font-medium ${viewMode === mode ? 'bg-blue-600 text-white' : 'bg-card text-foreground hover:bg-muted'}`}
              >
                {mode === 'day' ? 'Día' : 'Semana'}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              if (!validateDayForBooking(currentDate)) return;
              if (isDayFullyBooked(currentDate, fullyBookedDates)) {
                toast('Este día está completamente reservado. Como admin puedes agendar igualmente.', { icon: '⚠️' });
              }
              openModal();
            }}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="mr-2 h-5 w-5" />
            Nueva Cita
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : viewMode === 'week' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Arrastra una cita para cambiarla de día u hora. Haz clic en un hueco vacío para crear una nueva.
            </p>
            {professionalList.length > 1 && isManager && (
              <select
                aria-label="Filtrar por profesional"
                value={agendaProfessionalId}
                onChange={(e) => setAgendaProfessionalId(e.target.value)}
                className="px-3 py-1 border border-border rounded-full bg-card text-sm"
              >
                <option value="">Todos los profesionales</option>
                {professionalList.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <WeekAgenda
            appointments={weekEvents}
            date={currentDate}
            view={calendarView}
            hours={weekHours}
            stepMinutes={bookingSettings?.slotIntervalMin ?? 30}
            onNavigate={(d) => {
              setCurrentDate(d);
              setVisibleMonth(d);
            }}
            onViewChange={setCalendarView}
            onSelectAppointment={(apt) => openModal(apt)}
            onCreateAt={(dateStr, startTime) =>
              openModal(undefined, { date: dateStr, startTime, serviceId: '', professionalId: agendaProfessionalId })
            }
            onMove={handleMoveAppointment}
          />
        </div>
      ) : (
        <div className="flex flex-col xl:flex-row gap-8">
          {/* COLUMNA IZQUIERDA: CALENDARIO — ancho fijo, no fracción del
              grid: una columna proporcional puede quedar más angosta que
              el mínimo que necesita el calendario justo al filo de un
              breakpoint (nos pasó exactamente en xl con 4/12). */}
          <div className="w-full xl:w-80 xl:shrink-0 space-y-4">
            <Card className="p-4 shadow-sm border-border rounded-2xl">
              {/* Red de seguridad: si el calendario alguna vez necesita más
                  ancho del que tiene la tarjeta (fuente distinta, zoom del
                  navegador...), se puede desplazar en vez de recortarse. */}
              <div className="overflow-x-auto">
                <Calendar
                  mode="single"
                  locale={es}
                  month={visibleMonth}
                  onMonthChange={setVisibleMonth}
                  selected={currentDate}
                  onSelect={handleDateSelect}
                  modifiers={{
                    unavailable: unavailableDays,
                    fullyBooked: fullyBookedDays,
                    hasAppointments: appointmentDays,
                  }}
                  modifiersClassNames={{
                    unavailable: 'bg-muted text-muted-foreground opacity-80',
                    fullyBooked: 'bg-amber-100 text-amber-800 font-medium',
                    hasAppointments: 'relative font-semibold after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-blue-500',
                  }}
                  className="rounded-md w-full min-w-[17rem]"
                  classNames={{
                    day_selected: 'bg-blue-600 text-white hover:bg-blue-700 rounded-full',
                  }}
                />
              </div>

              <div className="mt-4 pt-4 border-t border-border space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-muted border border-border" />
                  No disponible
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-100 border border-amber-300" />
                  Completo
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  Con citas
                </div>
              </div>
            </Card>

            {isManager && (
              <button
                onClick={() => {
                  setSelectedDate(format(currentDate, 'yyyy-MM-dd'));
                  setActiveTab('schedule');
                  setShowModal(true);
                }}
                className="w-full py-3 px-4 border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl font-medium transition flex items-center justify-center gap-2"
              >
                <CalendarIcon className="w-4 h-4" />
                Gestionar Horario de este Día
              </button>
            )}
          </div>

          {/* COLUMNA DERECHA: AGENDA DEL DÍA */}
          <div className="min-w-0 flex-1 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
              <h3 className="text-xl font-bold text-foreground">
                Agenda del {format(currentDate, "EEEE d 'de' MMMM", { locale: es })}
              </h3>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    selectedDayStatus.variant === 'available'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : selectedDayStatus.variant === 'full'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : selectedDayStatus.variant === 'unavailable'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-muted text-muted-foreground border-border'
                  }
                >
                  {selectedDayStatus.label}
                </Badge>
                {professionalList.length > 1 && isManager && (
                  <select
                    aria-label="Filtrar por profesional"
                    value={agendaProfessionalId}
                    onChange={(e) => setAgendaProfessionalId(e.target.value)}
                    className="px-3 py-1 border border-border rounded-full bg-card text-sm"
                  >
                    <option value="">Todos los profesionales</option>
                    {professionalList.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                )}
                <span className="bg-muted text-foreground px-3 py-1 rounded-full text-sm font-medium">
                  {dailyAppointments.length} citas
                </span>
              </div>
            </div>

            {selectedDayStatus.variant === 'unavailable' && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-800">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>Este día está cerrado o fuera del horario comercial. Puedes consultar citas existentes o gestionar excepciones de horario.</p>
              </div>
            )}

            {selectedDayStatus.variant === 'full' && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>Todos los horarios de este día están reservados. Como administradora puedes agregar citas manualmente si es necesario.</p>
              </div>
            )}

            {canShowAvailableSlots && (
              <Card className="p-5 shadow-sm border-border rounded-2xl">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    Horarios disponibles
                  </h4>
                  {!slotsLoading && availableSlots.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Haz clic en un horario para crear una cita
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <select
                    aria-label="Servicio"
                    value={effectiveSlotServiceId}
                    onChange={(e) => setSlotServiceId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-sm"
                  >
                    {services.filter((svc) => svc.status === 'ACTIVE').map((svc) => (
                      <option key={svc.id} value={svc.id}>
                        {svc.name} · {svc.durationMinutes} min
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Profesional"
                    value={slotProfessionalId}
                    onChange={(e) => setSlotProfessionalId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-sm"
                  >
                    <option value="any">Cualquier profesional</option>
                    {professionalList.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>

                {slotsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    <span className="ml-3 text-sm text-muted-foreground">Cargando horarios...</span>
                  </div>
                ) : availableSlots.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {availableSlots.map((slot) => (
                      <Button
                        key={slot.startTime}
                        type="button"
                        variant="outline"
                        onClick={() => handleSlotClick(slot)}
                        className="rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                      >
                        {slot.startTime}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Clock className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">No hay horarios disponibles</p>
                    <p className="text-xs mt-1">Ese servicio no tiene huecos libres este día (horario, profesionales o citas existentes).</p>
                  </div>
                )}
              </Card>
            )}

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4">
                Citas programadas
              </h4>

            {dailyAppointments.length === 0 ? (
              <div className="text-center py-12 bg-muted border border-dashed border-border rounded-2xl">
                <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <h3 className="text-lg font-medium text-foreground">
                  {selectedDayStatus.variant === 'unavailable' ? 'Día no operativo' : 'Agenda libre'}
                </h3>
                <p className="text-muted-foreground mt-1">
                  {selectedDayStatus.variant === 'unavailable'
                    ? 'No hay actividad programada en un día cerrado.'
                    : selectedDayStatus.variant === 'full'
                      ? 'No hay citas registradas, pero todos los slots están ocupados.'
                      : 'No hay citas programadas para este día.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dailyAppointments.map((appointment) => (
                  <Card
                    key={appointment.id}
                    className="overflow-hidden border-l-4 shadow-sm hover:shadow-md transition"
                    style={{
                      borderLeftColor: STATUS_STYLES[appointment.status].border,
                    }}
                  >
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="font-bold text-foreground">
                            {appointment.startTime} - {appointment.endTime}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={STATUS_STYLES[appointment.status].badge}
                        >
                          {STATUS_STYLES[appointment.status].label}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-foreground">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{appointment.client?.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-foreground">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span>{appointment.serviceName}</span>
                        </div>
                        {appointment.professional && (
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <UserCog className="w-4 h-4 text-muted-foreground" />
                            <span>{appointment.professional.name}</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-2">
                          {appointment.status === 'PENDING' && (
                            <button
                              onClick={() => quickStatus(appointment, 'SCHEDULED')}
                              className="px-3 py-1 rounded-full text-xs font-medium border border-blue-200 text-blue-700 hover:bg-blue-50"
                            >
                              Confirmar
                            </button>
                          )}
                          {(appointment.status === 'SCHEDULED' || appointment.status === 'PENDING') && (
                            <>
                              <button
                                onClick={() => quickStatus(appointment, 'COMPLETED')}
                                className="px-3 py-1 rounded-full text-xs font-medium border border-green-200 text-green-700 hover:bg-green-50"
                              >
                                Completar
                              </button>
                              <button
                                onClick={() => quickStatus(appointment, 'NO_SHOW')}
                                className="px-3 py-1 rounded-full text-xs font-medium border border-border text-muted-foreground hover:bg-muted"
                              >
                                No asistió
                              </button>
                              <button
                                onClick={() => quickStatus(appointment, 'CANCELLED')}
                                className="px-3 py-1 rounded-full text-xs font-medium border border-red-200 text-red-700 hover:bg-red-50"
                              >
                                Cancelar
                              </button>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => openModal(appointment)}
                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          <Edit className="w-4 h-4" /> Editar Cita
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Modal - Crear/Editar Cita */}
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAppointment ? 'Editar Cita' : 'Crear Cita'} {selectedDate ? ` • ${format(new Date(selectedDate), 'dd/MM/yyyy', { locale: es })}` : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="border-b border-border pb-4">
              <nav className="flex flex-wrap gap-2 sm:gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('appointment')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    activeTab === 'appointment'
                      ? 'bg-card text-blue-700 border border-blue-200 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card hover:border hover:border-border'
                  }`}
                >
                  Agendar Cita
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('schedule')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    activeTab === 'schedule'
                      ? 'bg-card text-blue-700 border border-blue-200 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card hover:border hover:border-border'
                  }`}
                >
                  Gestionar Horario del Día
                </button>
              </nav>
            </div>

            {activeTab === 'appointment' ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-border pb-4">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2 border-b border-border pb-2">Detalles de la Cita</h4>
                    <label htmlFor="client" className="block text-sm font-medium text-foreground mb-1">
                      Clienta <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="client"
                      value={formData.clientId}
                      onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                      required
                    >
                      <option value="">-- Selecciona una clienta --</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name} ({client.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="service" className="block text-sm font-medium text-foreground mb-1">
                      Servicio <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="service"
                      value={formData.serviceId}
                      onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                      required
                    >
                      <option value="">-- Selecciona un servicio --</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name} (${Number(service.price).toFixed(2)} · {service.durationMinutes} min)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border-b border-border pb-4">
                  <label htmlFor="professional" className="block text-sm font-medium text-foreground mb-1">
                    Profesional
                  </label>
                  <select
                    id="professional"
                    value={formData.professionalId}
                    onChange={(e) => setFormData({ ...formData, professionalId: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  >
                    <option value="">Cualquiera disponible</option>
                    {professionalList.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-border pb-4">
                  <div>
                    <label htmlFor="date" className="block text-sm font-medium text-foreground mb-1">
                      Fecha de la Cita <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="startTime" className="block text-sm font-medium text-foreground mb-1">
                      Hora de Inicio <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="startTime"
                      value={modalStartTimes.includes(formData.startTime) ? formData.startTime : ''}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      disabled={!formData.serviceId}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:bg-muted"
                      required
                    >
                      <option value="">
                        {!formData.serviceId ? 'Elige primero un servicio' : modalSlotsLoading ? 'Cargando...' : '-- Selecciona una hora --'}
                      </option>
                      {modalStartTimes.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                    {formData.serviceId && !modalSlotsLoading && modalStartTimes.length === 0 && (
                      <p className="mt-1 text-xs text-amber-700">No hay horarios libres con esa combinación.</p>
                    )}
                  </div>
                </div>

                <div className="border-b border-border pb-4">
                  <label htmlFor="notes" className="block text-sm font-medium text-foreground mb-1">
                    Notas (opcional)
                  </label>
                  <textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="Ej: Cliente prefiere lado izquierdo, alergia a servicios sin perfume..."
                  />
                </div>

                <div className="border-b border-border pb-4">
                  <label htmlFor="status" className="block text-sm font-medium text-foreground mb-1">
                    Estado <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as AppointmentStatus })}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  >
                    <option value="PENDING">Pendiente</option>
                    <option value="SCHEDULED">Agendada</option>
                    <option value="COMPLETED">Completada</option>
                    <option value="NO_SHOW">No asistió</option>
                    <option value="CANCELLED">Cancelada</option>
                  </select>
                </div>

                <div className="flex justify-between gap-3 pt-6 border-t border-border">
                  {editingAppointment ? (
                    <button
                      type="button"
                      onClick={() => setItemToDelete(editingAppointment.id)}
                      className="inline-flex items-center justify-center px-6 py-2 text-sm font-medium text-red-700 bg-red-100 border border-transparent rounded-lg transition hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />Eliminar
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-6 py-2 text-sm font-medium text-foreground bg-muted rounded-lg hover:bg-muted transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      className="inline-flex items-center px-8 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {(createMutation.isPending || updateMutation.isPending) ? 'Guardando...' : 'Guardar Cita'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                {overrideLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  </div>
                ) : (
                  <>
                    <div className="border-b border-border pb-4">
                      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="text-blue-500">
                          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-blue-800">{scheduleOverride ? 'Horario Personalizado' : 'Horario General'}</h4>
                          <p className="text-sm text-blue-700 mt-1">
                            {scheduleOverride
                              ? 'Este día tiene una excepción de horario personalizada.'
                              : 'Este día usa el horario general configurado. Haz clic en "Modificar" para crear una excepción.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="border-b border-border pb-4">
                      <label className="block text-sm font-medium text-foreground mb-2">Horarios disponibles para este día</label>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <input
                          type="time"
                          value={newSlotInput}
                          onChange={(e) => setNewSlotInput(e.target.value)}
                          className="w-full md:w-auto px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                          placeholder="Ej: 10:00"
                        />
                        <button
                          type="button"
                          onClick={handleAddTimeSlot}
                          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition"
                        >
                          + Agregar
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">Agrega horarios específicos para este día. Se ordenarán automáticamente.</p>

                      <div className="flex flex-wrap gap-2 mt-3">
                        {sortTimeSlots(overrideTimeSlots).map((slot) => (
                          <span key={slot} className="inline-flex items-center gap-2 rounded-full bg-blue-100 text-blue-800 text-xs px-2 py-1">
                            {slot}
                            <button type="button" onClick={() => handleRemoveTimeSlot(slot)} className="font-bold rounded-full hover:text-blue-900">×</button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-between gap-3 pt-6 border-t border-border">
                      {scheduleOverride && (
                        <button
                          type="button"
                          onClick={handleRestoreDefaultSchedule}
                          disabled={deleteOverrideMutation.isPending}
                          className="px-6 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition disabled:opacity-50"
                        >
                          {deleteOverrideMutation.isPending ? 'Restaurando...' : 'Restaurar Horario Normal'}
                        </button>
                      )}

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setActiveTab('appointment')}
                          className="px-6 py-2 text-sm font-medium text-foreground bg-muted rounded-lg hover:bg-muted transition"
                        >
                          Volver
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveScheduleOverride}
                          disabled={upsertOverrideMutation.isPending}
                          className="px-8 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
        </DialogContent>
      </Dialog>
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