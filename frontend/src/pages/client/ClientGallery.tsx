import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useGalleryItems, useAvailableSlots, useCreateClientAppointment } from '../../hooks/useQueries';
import type { GalleryItem } from '../../types';
import toast from 'react-hot-toast';

const ClientGallery: React.FC = () => {
  const { data: galleryItems = [], isLoading: galleryLoading } = useGalleryItems();
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');

  const { data: availableSlots = [], isLoading: slotsLoading, refetch: refetchSlots } = useAvailableSlots(selectedDate);

  const appointmentMutation = useCreateClientAppointment({
    onSuccess: () => {
      toast.success('¡Cita creada con éxito!');
      setSelectedItem(null);
      setSelectedDate('');
      setSelectedSlot('');
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'No se pudo crear la cita.';
      toast.error(errorMessage);
    },
  });

  useEffect(() => {
    if (selectedDate) {
      refetchSlots();
      setSelectedSlot('');
    }
  }, [selectedDate, refetchSlots]);

  const closeModal = () => {
    setSelectedItem(null);
    setSelectedDate('');
    setSelectedSlot('');
  };

  const handleBookStyle = () => {
    if (!selectedItem) return;
    if (!selectedDate) {
      toast.error('Selecciona una fecha.');
      return;
    }
    if (!selectedSlot) {
      toast.error('Selecciona una hora.');
      return;
    }

    const [hour, minute] = selectedSlot.split(':').map(Number);
    const endHour = hour + 1;
    const endTime = `${String(endHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    appointmentMutation.mutate({
      productId: selectedItem.productId,
      date: selectedDate,
      startTime: selectedSlot,
      endTime,
      notes: `Reservado desde inspiración: ${selectedItem.title}`,
    });
  };

  if (galleryLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="h-8 w-8 text-purple-600" />
          <h1 className="text-4xl font-bold text-gray-900">Inspiración</h1>
        </div>
        <p className="text-gray-600 text-lg">
          Explora diseños de manicura y reserva la cita sin pasos adicionales.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {galleryItems.map((item) => (
          <div 
            key={item.id} 
            onClick={() => {
              if (!item.isActive) {
                toast.error('Este estilo no está activo');
                return;
              }
              setSelectedItem(item);
              setSelectedDate('');
              setSelectedSlot('');
            }}
            className="group flex flex-col relative overflow-hidden rounded-xl cursor-pointer shadow-md bg-white border border-gray-100 transition-transform hover:-translate-y-1"
          >
            <div className="relative h-64 w-full overflow-hidden">
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="hidden md:flex absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex-col items-center justify-center">
                <span className="rounded-full bg-pink-500 px-6 py-2 font-semibold text-white shadow-lg transform translate-y-4 transition-transform duration-300 group-hover:translate-y-0">
                  Agendar estilo
                </span>
              </div>
            </div>

            <div className="flex flex-col p-4 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 truncate pr-2" title={item.title}>
                  {item.title}
                </h3>
                <span className="font-bold text-pink-600 whitespace-nowrap">
                  {item.product?.price ?? '—'} {item.product?.currency ?? ''}
                </span>
              </div>
              
              <div className="mt-3 md:hidden w-full rounded-md bg-pink-50 py-2 text-center text-sm font-semibold text-pink-600 border border-pink-100">
                Toca para agendar
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white/80 border border-white/30 shadow-2xl backdrop-blur-xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Reserva: {selectedItem.title}</h3>
              <button
                onClick={closeModal}
                className="text-blue-100 hover:text-white focus:outline-none transition"
              >
                ✕
              </button>
            </div>

            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fecha <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hora <span className="text-red-500">*</span></label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    value={selectedSlot}
                    onChange={(e) => setSelectedSlot(e.target.value)}
                    disabled={!selectedDate || slotsLoading || availableSlots.length === 0}
                  >
                    <option value="">-- Selecciona una hora --</option>
                    {availableSlots.map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                  {selectedDate && !slotsLoading && availableSlots.length === 0 && (
                    <p className="text-sm text-red-500 mt-2">No hay horarios disponibles para la fecha seleccionada.</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-200">Detalles del estilo seleccionado</h4>
                <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white">
                  <img src={selectedItem.imageUrl} alt={selectedItem.title} className="w-full h-60 object-cover" />
                  <div className="p-4">
                    <p className="text-lg font-semibold text-gray-900">{selectedItem.title}</p>
                    <p className="text-sm text-gray-500 mt-1">{selectedItem.product?.price ?? '—'} {selectedItem.product?.currency ?? ''}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                <button
                  onClick={closeModal}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleBookStyle}
                  disabled={appointmentMutation.isPending}
                  className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {appointmentMutation.isPending ? 'Agendando...' : 'Confirmar cita'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientGallery;
