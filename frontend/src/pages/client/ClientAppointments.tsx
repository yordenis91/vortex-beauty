import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useClientAppointments, useClientProducts, useCreateClientAppointment, useAvailableSlots, useClosedDates, useCancelAppointment, useFullyBookedDates } from '../../hooks/useQueries';
import { Calendar as CalendarIcon, Clock, X, CheckCircle, Trash2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  date: Date | undefined;
  startTime: string;
  endTime: string;
}

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
    date: undefined,
    startTime: '',
    endTime: '',
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEventModal, setSelectedEventModal] = useState<Appointment | null>(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState<string | null>(null);

  // Hooks
  const { data: appointments = [], isLoading: appointmentsLoading } = useClientAppointments();
  const { data: products = [] } = useClientProducts();
  const { data: availableSlots = [], isLoading: slotsLoading } = useAvailableSlots(
    formData.date ? format(formData.date, 'yyyy-MM-dd') : ''
  );
  const { data: businessHours = [] } = useBusinessHours();
  const { data: closedDates = [] } = useClosedDates();
  const { data: fullyBookedDates = [] } = useFullyBookedDates();

  const createMutation = useCreateClientAppointment({
    onSuccess: () => {
      toast.success('¡Cita agendada correctamente!');
      resetForm();
      setDrawerOpen(false);
    },
  });

  const cancelMutation = useCancelAppointment({
    onSuccess: () => {
      setSelectedEventModal(null);
      setAppointmentToCancel(null);
    },
  });

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

    // Verificar si el día está 100% reservado
    const dateStr = format(date, 'yyyy-MM-dd');
    if (fullyBookedDates.includes(dateStr)) {
      return true;
    }

    return false;
  };

  // Filtrar citas de la clienta actual
  const clientAppointments = useMemo(() => {
    return appointments.filter((apt: Appointment) => apt.clientId === user?.id);
  }, [appointments, user?.id]);

  // Próximas citas (SCHEDULED) - solo futuras o de hoy
  const upcomingAppointments = useMemo(() => {
    const today = startOfDay(new Date());
    return clientAppointments
      .filter((apt: Appointment) => {
        if (apt.status !== 'SCHEDULED') return false;
        const appointmentDate = startOfDay(parseISO(apt.date));
        return !isBefore(appointmentDate, today); // Fecha futura o igual a hoy
      })
      .sort((a: Appointment, b: Appointment) => {
        const dateA = parseISO(`${a.date}T${a.startTime}`);
        const dateB = parseISO(`${b.date}T${b.startTime}`);
        return dateA.getTime() - dateB.getTime();
      });
  }, [clientAppointments]);

  const formatDate = (date: string, time: string) => {
    try {
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

  const handleSelectSlot = (slotTime: string) => {
    const [hours, minutes] = slotTime.split(':').map(Number);
    const endHour = hours + 1;
    const endTime = `${endHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    setFormData({
      ...formData,
      startTime: slotTime,
      endTime: endTime,
    });
  };

  const handleCancelAppointmentClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const appointmentId = event.currentTarget.getAttribute('data-appointment-id');
    if (!appointmentId) return;

    const appointment = upcomingAppointments.find(apt => apt.id === appointmentId);
    if (!appointment) return;

    if (!canCancelAppointment(appointment.date, appointment.startTime)) {
      toast.error('Las citas deben ser canceladas con al menos 24 horas de anticipación');
      return;
    }

    setAppointmentToCancel(appointmentId);
  };

  const handleConfirmCancel = () => {
    if (appointmentToCancel) {
      cancelMutation.mutate(appointmentToCancel);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.productId || !formData.date || !formData.startTime) {
      toast.error('Por favor completa todos los campos');
      return;
    }

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
      date: undefined,
      startTime: '',
      endTime: '',
    });
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date && !isDayBlocked(date)) {
      setFormData({
        ...formData,
        date,
        startTime: '',
        endTime: '',
      });
    } else if (date && isDayBlocked(date)) {
      toast.error('Este día no está disponible');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mis Citas</h1>
        <p className="text-gray-600 mt-2">Selecciona una fecha para agendar tu próxima cita</p>
      </div>

      {/* Mis Próximas Citas */}
      {appointmentsLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i} className="rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden">
              <div className="animate-pulse p-6">
                <div className="flex items-center space-x-4">
                  <div className="bg-slate-200 rounded-xl p-3 min-w-[70px] h-16"></div>
                  <div className="flex-1 space-y-2">
                    <div className="bg-slate-200 h-4 rounded w-3/4"></div>
                    <div className="bg-slate-200 h-3 rounded w-1/2"></div>
                  </div>
                  <div className="bg-slate-200 rounded-full w-10 h-10"></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : upcomingAppointments.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Mis Próximas Citas</h2>
          {upcomingAppointments.map((appointment) => {
            const appointmentDate = parseISO(appointment.date);
            const day = format(appointmentDate, 'd', { locale: es });
            const month = format(appointmentDate, 'MMM', { locale: es });

            return (
              <Card key={appointment.id} className="rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-center space-x-4">
                    {/* Recuadro con día y mes */}
                    <div className="bg-indigo-50 text-indigo-700 rounded-xl p-3 text-center min-w-[70px]">
                      <div className="text-lg font-bold">{day}</div>
                      <div className="text-xs uppercase">{month}</div>
                    </div>

                    {/* Información de la cita */}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {appointment.product?.name || 'Servicio'}
                      </h3>
                      <div className="flex items-center mt-1 text-gray-600">
                        <Clock className="w-3 h-3 mr-1" />
                        <span className="text-sm">{appointment.startTime}</span>
                      </div>
                    </div>

                    {/* Botón de cancelar */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                      onClick={handleCancelAppointmentClick}
                      data-appointment-id={appointment.id}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* Calendar Card */}
      {appointmentsLoading ? (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden mb-8 p-6">
          <Calendar
            mode="single"
            selected={formData.date}
            onSelect={handleDateSelect}
            disabled={isDayBlocked}
            className="rounded-lg"
            classNames={{
              day_selected: "bg-indigo-600 text-white hover:bg-indigo-700 rounded-full",
              day_disabled: "text-gray-400 cursor-not-allowed",
            }}
          />
        </Card>
      )}

      {/* Drawer para seleccionar hora y servicio */}
      {formData.date && !isDayBlocked(formData.date) && (
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger asChild>
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-3 text-lg font-semibold">
              Ver horarios para {format(formData.date, 'EEEE d MMMM', { locale: es })}
            </Button>
          </DrawerTrigger>
          <DrawerContent className="px-4 pb-10">
            <DrawerHeader>
              <DrawerTitle>Selecciona tu horario y servicio</DrawerTitle>
            </DrawerHeader>

            <form onSubmit={handleSubmit} className="space-y-6 mt-6">
              {/* Seleccionar Servicio */}
              <div>
                <label className="text-sm font-semibold text-gray-900 mb-3 block">
                  Servicio <span className="text-red-500">*</span>
                </label>
                <Select value={formData.productId} onValueChange={(value) => setFormData({ ...formData, productId: value })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} - ${Number(product.price).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Horarios disponibles */}
              <div>
                <label className="text-sm font-semibold text-gray-900 mb-3 block">Hora <span className="text-red-500">*</span></label>
                {slotsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <span className="ml-3 text-gray-600">Cargando horarios...</span>
                  </div>
                ) : availableSlots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {availableSlots.map((slot) => (
                      <Button
                        key={slot}
                        type="button"
                        variant={formData.startTime === slot ? "default" : "outline"}
                        onClick={() => handleSelectSlot(slot)}
                        className={formData.startTime === slot ? "bg-indigo-600" : "rounded-xl"}
                      >
                        {slot}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">No hay horarios disponibles</p>
                    <p className="text-sm mt-1">Intenta seleccionar otra fecha</p>
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex gap-3 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDrawerOpen(false);
                    resetForm();
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !formData.productId || !formData.startTime}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                >
                  {createMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Agendando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Confirmar Cita
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DrawerContent>
        </Drawer>
      )}

      {/* Modal de Detalles del Evento */}
      {selectedEventModal && !appointmentToCancel && (
        <div className="fixed inset-0 bg-black/50 transition-opacity flex items-center justify-center z-50 p-4">
          <div className="absolute inset-0" onClick={() => setSelectedEventModal(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Detalles de tu Cita</h3>
              <button
                type="button"
                onClick={() => setSelectedEventModal(null)}
                className="text-white hover:text-indigo-100 focus:outline-none"
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
                  <CalendarIcon className="h-5 w-5 text-indigo-600" />
                  {formatDate(selectedEventModal.date, selectedEventModal.startTime)}
                </p>
              </div>

              {/* Precio */}
              {selectedEventModal.product?.price && (
                <div className="border-b border-gray-200 pb-4">
                  <p className="text-sm font-medium text-gray-500">Precio</p>
                  <p className="text-lg font-semibold text-indigo-600 mt-1">
                    ${Number(selectedEventModal.product.price).toFixed(2)}
                  </p>
                </div>
              )}

              {/* Estado */}
              <div className="pb-6">
                <p className="text-sm font-medium text-gray-500">Estado</p>
                <Badge className="mt-1">
                  {selectedEventModal.status === 'SCHEDULED' && 'Agendada'}
                  {selectedEventModal.status === 'COMPLETED' && 'Completada'}
                  {selectedEventModal.status === 'CANCELLED' && 'Cancelada'}
                </Badge>
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedEventModal(null)}
                  className="flex-1"
                >
                  Cerrar
                </Button>
                {selectedEventModal.status === 'SCHEDULED' && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleCancelAppointmentClick}
                    disabled={cancelMutation.isPending}
                    className="flex-1"
                  >
                    {cancelMutation.isPending ? 'Cancelando...' : 'Cancelar Cita'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AlertDialog para cancelación */}
      <AlertDialog open={appointmentToCancel !== null} onOpenChange={(open) => !open && setAppointmentToCancel(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              ¿Cancelar esta cita?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Por respeto al tiempo de nuestras especialistas, te pedimos cancelar solo si es estrictamente necesario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {appointmentToCancel && (() => {
            const appointment = upcomingAppointments.find(apt => apt.id === appointmentToCancel);
            return appointment ? (
              <div className="py-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-yellow-800">
                    Esta acción no se puede deshacer. Se enviará una notificación al salón sobre la cancelación.
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600">Cita a Cancelar:</p>
                  <p className="text-base font-semibold text-gray-900">
                    {appointment.product?.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {format(parseISO(`${appointment.date}T${appointment.startTime}`), 'EEEE d MMMM yyyy - HH:mm', { locale: es })}
                  </p>
                </div>
              </div>
            ) : null;
          })()}
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleConfirmCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelando...' : 'Sí, cancelar cita'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientAppointments;
