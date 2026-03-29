import React, { useState, useMemo } from 'react';
import { useAppointments, useClients, useProducts, useCreateAppointment, useUpdateAppointment, useDeleteAppointment } from '../hooks/useQueries';
import { Calendar, Plus, Edit, Trash2, Check, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';

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
}

type FilterType = 'today' | 'tomorrow' | 'all';

const Appointments: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');

  const [formData, setFormData] = useState<FormData>({
    clientId: '',
    productId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '11:00',
    notes: '',
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
    },
  });

  // Funciones de filtrado
  const getToday = () => new Date().toISOString().split('T')[0];
  const getTomorrow = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
  };

  const filteredAppointments = useMemo(() => {
    let filtered = appointments;

    if (filterType === 'today') {
      filtered = filtered.filter(a => a.date.split('T')[0] === getToday());
    } else if (filterType === 'tomorrow') {
      filtered = filtered.filter(a => a.date.split('T')[0] === getTomorrow());
    }

    return filtered.sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [appointments, filterType]);

  // Funciones de Modal
  const openModal = (appointment?: Appointment) => {
    if (appointment) {
      setEditingAppointment(appointment);
      setFormData({
        clientId: appointment.clientId,
        productId: appointment.productId,
        date: appointment.date.split('T')[0],
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        notes: appointment.notes || '',
      });
    } else {
      setEditingAppointment(null);
      setFormData({
        clientId: '',
        productId: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '11:00',
        notes: '',
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
  const handleCompleteAppointment = (appointment: Appointment) => {
    if (appointment.status === 'COMPLETED') {
      toast.success('Esta cita ya está completada');
      return;
    }

    updateMutation.mutate({
      id: appointment.id,
      appointmentData: {
        status: 'COMPLETED',
      },
    });
  };

  const handleDeleteAppointment = (id: string) => {
    deleteMutation.mutate(id);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      SCHEDULED: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
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
            Gestiona todas las citas del salón de belleza
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

      {/* Filter Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {[
              { id: 'all', label: 'Todas las Citas' },
              { id: 'today', label: 'Hoy' },
              { id: 'tomorrow', label: 'Mañana' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id as FilterType)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  filterType === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Appointments List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Calendar className="h-12 w-12 text-gray-400 flex-shrink-0 mb-4" />
              <h3 className="text-sm font-medium text-gray-900">Sin citas programadas</h3>
              <p className="mt-1 text-sm text-gray-500">
                {filterType !== 'all'
                  ? `No hay citas para ${filterType === 'today' ? 'hoy' : 'mañana'}.`
                  : 'Comienza creando una nueva cita'}
              </p>
              <button
                onClick={() => openModal()}
                className="mt-4 inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nueva Cita
              </button>
            </div>
          </div>
        ) : (
          filteredAppointments.map((appointment) => (
            <div key={appointment.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Date */}
                    <p className="text-sm font-semibold text-gray-500 mb-2">
                      {formatDate(appointment.date)}
                    </p>

                    {/* Time and Status */}
                    <div className="flex items-baseline gap-3 mb-3">
                      <div className="flex items-center text-lg font-bold text-gray-900">
                        <Clock className="h-5 w-5 mr-2 text-blue-600" />
                        {appointment.startTime} - {appointment.endTime}
                      </div>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusBadge(appointment.status)}`}>
                        {appointment.status === 'SCHEDULED' && 'Programada'}
                        {appointment.status === 'COMPLETED' && 'Completada'}
                        {appointment.status === 'CANCELLED' && 'Cancelada'}
                      </span>
                    </div>

                    {/* Client and Service */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Clienta</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                          {appointment.client?.name || 'No asignada'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Servicio</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                          {appointment.product?.name || 'No especificado'}
                        </p>
                        {appointment.product?.price && (
                          <p className="text-xs text-gray-500 mt-1">
                            ${Number(appointment.product.price).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    {appointment.notes && (
                      <div className="mt-3 p-2 bg-gray-50 rounded border border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1">Notas</p>
                        <p className="text-sm text-gray-700">{appointment.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="ml-4 flex gap-2 flex-shrink-0">
                    {appointment.status !== 'COMPLETED' && appointment.status !== 'CANCELLED' && (
                      <button
                        onClick={() => handleCompleteAppointment(appointment)}
                        className="inline-flex items-center justify-center rounded-md bg-green-50 p-2 text-green-700 hover:bg-green-100 transition-colors"
                        title="Completar cita"
                      >
                        <Check className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      onClick={() => openModal(appointment)}
                      className="inline-flex items-center justify-center rounded-md bg-blue-50 p-2 text-blue-700 hover:bg-blue-100 transition-colors"
                      title="Editar cita"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setItemToDelete(appointment.id)}
                      className="inline-flex items-center justify-center rounded-md bg-red-50 p-2 text-red-700 hover:bg-red-100 transition-colors"
                      title="Eliminar cita"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {editingAppointment ? 'Editar Cita' : 'Nueva Cita'}
                  </h3>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Clienta */}
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

                  {/* Botones */}
                  <div className="flex justify-end gap-3 pt-6 border-t">
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
