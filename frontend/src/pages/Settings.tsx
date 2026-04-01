import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useClosedDates, useCreateClosedDate, useDeleteClosedDate } from '../hooks/useQueries';
import { Trash2 } from 'lucide-react';

interface BusinessHour {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timeSlots: string[];
  isOpen: boolean;
  maxAppointments: number;
  createdAt: string;
  updatedAt: string;
}

const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Hook para obtener horarios comerciales
const useBusinessHours = () => {
  return useQuery({
    queryKey: ['businessHours'],
    queryFn: async () => {
      const response = await api.get('/settings/business-hours');
      return response.data as BusinessHour[];
    },
  });
};

// Hook para actualizar un horario específico
const useUpdateBusinessHour = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { dayOfWeek: number; startTime: string; endTime: string; timeSlots: string[]; isOpen: boolean; maxAppointments: number }) => {
      const response = await api.put(`/settings/business-hours/${data.dayOfWeek}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessHours'] });
      toast.success('Horario actualizado correctamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al actualizar el horario');
    },
  });
};

const Settings: React.FC = () => {
  const { data: businessHours = [], isLoading } = useBusinessHours();
  const updateMutation = useUpdateBusinessHour();
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [formData, setFormData] = useState<{ [key: number]: BusinessHour }>({});
  const [newSlotInput, setNewSlotInput] = useState<{ [key: number]: string }>({});

  // Estados para días de cierre
  const [newClosedDate, setNewClosedDate] = useState('');
  const [newClosedReason, setNewClosedReason] = useState('');

  // Hooks para closed dates
  const { data: closedDates = [] } = useClosedDates();
  const createClosedDateMutation = useCreateClosedDate();
  const deleteClosedDateMutation = useDeleteClosedDate();

  // Inicializar formData cuando los datos se cargan
  useEffect(() => {
    if (businessHours.length > 0) {
      const initialData = businessHours.reduce((acc, hour) => {
        acc[hour.dayOfWeek] = hour;
        return acc;
      }, {} as { [key: number]: BusinessHour });
      setFormData(initialData);
    }
  }, [businessHours]);

  const handleToggleDay = (dayOfWeek: number) => {
    const currentData = formData[dayOfWeek];
    if (!currentData) return;

    const updatedData = {
      ...currentData,
      isOpen: !currentData.isOpen,
    };

    updateMutation.mutate({
      dayOfWeek,
      startTime: updatedData.startTime,
      endTime: updatedData.endTime,
      timeSlots: updatedData.timeSlots || [],
      isOpen: updatedData.isOpen,
      maxAppointments: updatedData.maxAppointments,
    });
  };

  const sortTimeSlots = (slots: string[]) =>
    [...slots].slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const handleTimeChange = (
    dayOfWeek: number,
    field: 'startTime' | 'endTime' | 'maxAppointments' | 'timeSlots',
    value: string | number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [dayOfWeek]: {
        ...prev[dayOfWeek],
        [field]: field === 'timeSlots'
          ? sortTimeSlots((value as string).split(',').map(str => str.trim()).filter(Boolean))
          : value,
      },
    }));
    setEditingDay(dayOfWeek);
  };

  const handleAddTimeSlot = (dayOfWeek: number) => {
    const dayData = formData[dayOfWeek];
    const slotValue = newSlotInput[dayOfWeek]?.trim();
    if (!dayData || !slotValue) return;

    const slotFormat = /^\d{2}:\d{2}$/;
    if (!slotFormat.test(slotValue)) {
      toast.error('El slot debe tener formato HH:mm');
      return;
    }

    if (dayData.timeSlots.includes(slotValue)) {
      toast.error('El slot ya existe');
      return;
    }

    const updatedSlots = sortTimeSlots([...dayData.timeSlots, slotValue]);

    setFormData(prev => ({
      ...prev,
      [dayOfWeek]: {
        ...prev[dayOfWeek],
        timeSlots: updatedSlots,
      },
    }));

    setNewSlotInput(prev => ({ ...prev, [dayOfWeek]: '' }));
    setEditingDay(dayOfWeek);
  };

  const handleRemoveTimeSlot = (dayOfWeek: number, slot: string) => {
    const dayData = formData[dayOfWeek];
    if (!dayData) return;

    const updatedSlots = dayData.timeSlots.filter(ts => ts !== slot);

    setFormData(prev => ({
      ...prev,
      [dayOfWeek]: {
        ...prev[dayOfWeek],
        timeSlots: updatedSlots,
      },
    }));

    setEditingDay(dayOfWeek);
  };

  const handleSaveDay = (dayOfWeek: number) => {
    const dayData = formData[dayOfWeek];
    if (!dayData) return;

    // Validar que la hora de inicio sea menor que la de fin
    if (dayData.isOpen) {
      const startMinutes = parseInt(dayData.startTime.split(':')[0]) * 60 + parseInt(dayData.startTime.split(':')[1]);
      const endMinutes = parseInt(dayData.endTime.split(':')[0]) * 60 + parseInt(dayData.endTime.split(':')[1]);

      if (startMinutes >= endMinutes) {
        toast.error('La hora de apertura debe ser menor que la de cierre');
        return;
      }

      if (endMinutes - startMinutes < 60) {
        toast.error('El horario debe tener al menos 1 hora de duración');
        return;
      }
    }

    if (dayData.timeSlots && dayData.timeSlots.length > 0) {
      const slotFormat = /^\d{2}:\d{2}$/;
      for (const slot of dayData.timeSlots) {
        if (!slotFormat.test(slot)) {
          toast.error('Los slots deben tener formato HH:mm');
          return;
        }
      }
    }

    updateMutation.mutate({
      dayOfWeek,
      startTime: dayData.startTime,
      endTime: dayData.endTime,
      timeSlots: sortTimeSlots(dayData.timeSlots || []),
      isOpen: dayData.isOpen,
      maxAppointments: dayData.maxAppointments || 0,
    });

    setEditingDay(null);
  };

  const handleCreateClosedDate = () => {
    if (!newClosedDate) {
      toast.error('Por favor selecciona una fecha');
      return;
    }

    createClosedDateMutation.mutate(
      { date: newClosedDate, reason: newClosedReason || undefined },
      {
        onSuccess: () => {
          setNewClosedDate('');
          setNewClosedReason('');
          toast.success('Día de cierre agregado correctamente');
        },
      }
    );
  };

  const handleDeleteClosedDate = (id: string) => {
    deleteClosedDateMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Día de cierre eliminado correctamente');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
          Configuración
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Gestiona los horarios comerciales del salón de belleza.
        </p>
      </div>

      {/* Business Hours Card */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Horarios Comerciales
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Define los horarios de apertura y cierre para cada día de la semana. Los clientes no podrán agendar citas fuera de estos horarios.
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {dayNames.map((dayName, dayOfWeek) => {
            const dayData = formData[dayOfWeek];
            if (!dayData) return null;

            const isBeingEdited = editingDay === dayOfWeek;

            return (
              <div key={dayOfWeek} className="px-4 py-6 sm:px-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <h4 className="text-base font-medium text-gray-900">{dayName}</h4>
                  </div>

                  {/* Toggle Switch */}
                  <div className="flex items-center">
                    <button
                      onClick={() => handleToggleDay(dayOfWeek)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        dayData.isOpen ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          dayData.isOpen ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="ml-3 text-sm font-medium text-gray-700">
                      {dayData.isOpen ? 'Abierto' : 'Cerrado'}
                    </span>
                  </div>
                </div>

                {/* Time Inputs */}
                {dayData.isOpen && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Hora de Apertura
                        </label>
                        <input
                          type="time"
                          value={dayData.startTime}
                          onChange={(e) =>
                            handleTimeChange(dayOfWeek, 'startTime', e.target.value)
                          }
                          disabled={!dayData.isOpen}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Hora de Cierre
                        </label>
                        <input
                          type="time"
                          value={dayData.endTime}
                          onChange={(e) =>
                            handleTimeChange(dayOfWeek, 'endTime', e.target.value)
                          }
                          disabled={!dayData.isOpen}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {/* Max Appointments Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Límite de citas (0 = Sin límite)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={dayData.maxAppointments || 0}
                        onChange={(e) =>
                          handleTimeChange(dayOfWeek, 'maxAppointments', parseInt(e.target.value) || 0)
                        }
                        className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border px-3 py-2"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Número máximo de citas permitidas en este día.
                      </p>
                    </div>

                    {/* Time Slots Management */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Agregar horario exacto (HH:mm)
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="time"
                          value={newSlotInput[dayOfWeek] || ''}
                          onChange={(e) =>
                            setNewSlotInput((prev) => ({ ...prev, [dayOfWeek]: e.target.value }))
                          }
                          className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border px-3 py-2"
                        />
                        <button
                          onClick={() => handleAddTimeSlot(dayOfWeek)}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                          +
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Pulsa + para añadir cada slot. Se requiere formato HH:mm.
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {sortTimeSlots(dayData.timeSlots || []).map((slot) => (
                          <span
                            key={`${dayOfWeek}-${slot}`}
                            className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 text-xs px-2 py-1"
                          >
                            {slot}
                            <button
                              onClick={() => handleRemoveTimeSlot(dayOfWeek, slot)}
                              className="ml-1 text-blue-800 hover:text-blue-900"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Save Button */}
                    {isBeingEdited && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveDay(dayOfWeek)}
                          disabled={updateMutation.isPending}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
                        >
                          {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button
                          onClick={() => {
                            const original = businessHours.find(
                              (bh) => bh.dayOfWeek === dayOfWeek
                            );
                            if (original) {
                              setFormData((prev) => ({
                                ...prev,
                                [dayOfWeek]: original,
                              }));
                            }
                            setEditingDay(null);
                          }}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Closed Dates Card */}
      <div className="bg-white rounded-lg shadow overflow-hidden mt-8">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Días de Cierre Específicos (Vacaciones/Feriados)
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Configura fechas específicas en las que el salón estará cerrado, como vacaciones o feriados.
          </p>
        </div>

        <div className="px-4 py-6 sm:px-6">
          {/* Formulario para agregar */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Cierre
                </label>
                <input
                  type="date"
                  value={newClosedDate}
                  onChange={(e) => setNewClosedDate(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border px-3 py-2"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo (Opcional)
                </label>
                <input
                  type="text"
                  value={newClosedReason}
                  onChange={(e) => setNewClosedReason(e.target.value)}
                  placeholder="Ej: Vacaciones"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border px-3 py-2"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleCreateClosedDate}
                  disabled={createClosedDateMutation.isPending}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
                >
                  {createClosedDateMutation.isPending ? 'Agregando...' : 'Agregar Día'}
                </button>
              </div>
            </div>
          </div>

          {/* Lista de días cerrados */}
          <div>
            <h4 className="text-base font-medium text-gray-900 mb-4">Días Configurados</h4>
            {closedDates.length === 0 ? (
              <p className="text-sm text-gray-500">No hay días de cierre configurados.</p>
            ) : (
              <div className="space-y-2">
                {closedDates.map((closedDate) => (
                  <div key={closedDate.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(closedDate.date).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </span>
                      {closedDate.reason && (
                        <span className="text-sm text-gray-600 ml-2">({closedDate.reason})</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteClosedDate(closedDate.id)}
                      disabled={deleteClosedDateMutation.isPending}
                      className="inline-flex items-center p-1 border border-transparent rounded-full text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
