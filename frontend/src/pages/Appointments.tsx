import React, { useState, useMemo } from 'react';
import { useAppointments, useClients, useProducts, useCreateAppointment, useUpdateAppointment, useDeleteAppointment } from '../hooks/useQueries';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale/es';

// Importaciones necesarias para el Drag and Drop
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

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

const Appointments: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

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
    } else {
      setEditingAppointment(null);
      let newDate = new Date().toISOString().split('T')[0];
      let newStartTime = '10:00';
      let newEndTime = '11:00';

      if (slotStart && slotEnd) {
        newDate = format(slotStart, 'yyyy-MM-dd');
        newStartTime = format(slotStart, 'HH:mm');
        newEndTime = format(slotEnd, 'HH:mm');
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
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAppointment(null);
  };

  // Funciones de Formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.clientId || !formData.productId) {
      toast.error('Por favor completa todos los campos requeridos');
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

  // Colorear eventos según el status
  const eventPropGetter = (event: CalendarEvent) => {
    const status = event.resource.status;
    
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
    openModal(undefined, slotInfo.start, slotInfo.end);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    openModal(event.resource);
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

    try {
      const updatedAppointment = {
        clientId: appointment.clientId,
        productId: appointment.productId,
        date: newStart.toISOString(),
        startTime: format(newStart, 'HH:mm'),
        endTime: format(newEnd, 'HH:mm'),
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

  const isLoading = appointmentsLoading || clientsLoading || productsLoading;

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
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 'calc(100vh - 200px)' }}
            selectable
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            onEventDrop={handleEventDrop}
            eventPropGetter={eventPropGetter}
            resizable={false}
            popup
            culture="es"
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
                
                {/* Header del Modal */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {editingAppointment ? 'Editar Cita' : 'Nueva Cita'}
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

                {/* Formulario */}
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