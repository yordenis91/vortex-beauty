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
          <div key={item.id} className="group relative overflow-hidden rounded-xl cursor-pointer shadow-md bg-white">
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex flex-col justify-end p-4">
              <p className="text-white font-bold text-lg">{item.title}</p>
              <p className="text-white/80 text-sm">{item.product?.price ?? '—'} {item.product?.currency ?? ''}</p>
              <button
                onClick={() => {
                  if (!item.isActive) {
                    toast.error('Este estilo no está activo');
                    return;
                  }
                  setSelectedItem(item);
                  setSelectedDate('');
                  setSelectedSlot('');
                }}
                className="mt-3 w-full rounded-md bg-pink-500 py-2 text-sm font-semibold text-white hover:bg-pink-600"
              >
                Agendar este estilo
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 relative">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
            >
              ✕
            </button>

            <h3 className="text-2xl font-bold mb-4">Reserva: {selectedItem.title}</h3>
            <img src={selectedItem.imageUrl} alt={selectedItem.title} className="w-full h-60 object-cover rounded-lg mb-4" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Fecha</label>
                <input
                  type="date"
                  className="mt-1 block w-full rounded-md border-gray-300"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Hora</label>
                <select
                  className="mt-1 block w-full rounded-md border-gray-300"
                  value={selectedSlot}
                  onChange={(e) => setSelectedSlot(e.target.value)}
                  disabled={!selectedDate || slotsLoading || availableSlots.length === 0}
                >
                  <option value="">Selecciona una hora</option>
                  {availableSlots.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
                {selectedDate && !slotsLoading && availableSlots.length === 0 && (
                  <p className="text-sm text-red-500 mt-2">No hay horarios disponibles para la fecha seleccionada.</p>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={closeModal}
                className="rounded-md px-4 py-2 border text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleBookStyle}
                disabled={appointmentMutation.isPending}
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                {appointmentMutation.isPending ? 'Agendando...' : 'Confirmar cita'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientGallery;
