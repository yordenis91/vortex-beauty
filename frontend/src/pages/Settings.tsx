import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

interface BusinessHour {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isOpen: boolean;
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
    mutationFn: async (data: { dayOfWeek: number; startTime: string; endTime: string; isOpen: boolean }) => {
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
      isOpen: updatedData.isOpen,
    });
  };

  const handleTimeChange = (dayOfWeek: number, field: 'startTime' | 'endTime', value: string) => {
    setFormData((prev) => ({
      ...prev,
      [dayOfWeek]: {
        ...prev[dayOfWeek],
        [field]: value,
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

    updateMutation.mutate({
      dayOfWeek,
      startTime: dayData.startTime,
      endTime: dayData.endTime,
      isOpen: dayData.isOpen,
    });

    setEditingDay(null);
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
    </div>
  );
};

export default Settings;
