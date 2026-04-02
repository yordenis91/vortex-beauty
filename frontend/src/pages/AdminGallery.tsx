import React, { useState } from 'react';
import type { GalleryItem, Product } from '../types';
import { useProducts, useAdminGalleryItems, useCreateGalleryItem, useUpdateGalleryItem, useDeleteGalleryItem } from '../hooks/useQueries';
import ConfirmModal from '../components/ConfirmModal';
import toast from 'react-hot-toast';

const AdminGallery: React.FC = () => {
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: galleryItems = [], isLoading: galleryLoading } = useAdminGalleryItems();

  const createMutation = useCreateGalleryItem();
  const updateMutation = useUpdateGalleryItem();
  const deleteMutation = useDeleteGalleryItem();

  const [form, setForm] = useState<{
    title: string;
    productId: string;
    imageUrl: string;
    isActive: boolean;
    file?: File;
  }>({
    title: '',
    productId: '',
    imageUrl: '',
    isActive: true,
  });

  const resetForm = () => {
    setForm({ title: '', productId: '', imageUrl: '', isActive: true });
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setForm((prev) => ({ ...prev, imageUrl: result, file }));
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.imageUrl || !form.productId) {
      toast.error('Completa todos los campos');
      return;
    }

    createMutation.mutate(
      {
        title: form.title,
        imageUrl: form.imageUrl,
        productId: form.productId,
        isActive: form.isActive,
      },
      {
        onSuccess: () => {
          toast.success('Diseño agregado correctamente');
          resetForm();
        },
      }
    );
  };

  const handleToggleActive = (item: GalleryItem) => {
    updateMutation.mutate({ id: item.id, payload: { isActive: !item.isActive } });
  };

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<GalleryItem | null>(null);

  const openDeleteModal = (item: GalleryItem) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setItemToDelete(null);
    setIsDeleteModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!itemToDelete) return;

    deleteMutation.mutate(itemToDelete.id, {
      onSuccess: () => {
        toast.success('Elemento eliminado');
        closeDeleteModal();
      },
      onError: (error: any) => {
        toast.error(error?.response?.data?.error || 'Error eliminando elemento');
      },
    });
  };

  if (productsLoading || galleryLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Galería de Inspiración (Admin)</h2>
        <p className="text-sm text-gray-500">Gestión de diseños para la página de clientes.</p>
      </div>

      <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-lg p-8 space-y-8">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-gray-900">Agregar nuevo diseño</h3>
          <span className="text-sm text-gray-500">Admin Gallery</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Título <span className="text-red-500">*</span></label>
            <input
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Servicio <span className="text-red-500">*</span></label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              value={form.productId}
              onChange={(e) => setForm((prev) => ({ ...prev, productId: e.target.value }))}
              required
            >
              <option value="">Selecciona un servicio</option>
              {products.map((product: Product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - {product.price} {product.currency}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Imagen <span className="text-red-500">*</span></label>
            <label htmlFor="image-upload" className="flex flex-col items-center justify-center w-full px-4 py-8 text-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
              <p className="text-sm font-medium text-gray-700">Arrastra y suelta tu imagen aquí, o haz clic para seleccionar</p>
              <p className="text-xs text-gray-500 mt-1">(JPG, PNG, GIF, máximo 10MB)</p>
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
                required
              />
            </label>
          </div>
        </div>

        {form.imageUrl && (
          <img src={form.imageUrl} alt="Preview" className="w-40 h-40 object-cover rounded-md" />
        )}

        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <span className="text-sm font-medium text-gray-700">Activo</span>
          </label>
          <button
            type="submit"
            className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Guardando...' : 'Agregar diseño'}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h3 className="text-2xl font-bold mb-4">Diseños existentes</h3>

        <div className="grid grid-cols-1 gap-4">
          {galleryItems.map((item) => (
            <div key={item.id} className="border border-gray-200 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-start bg-white">
              <img src={item.imageUrl} alt={item.title} className="w-full md:w-40 h-28 object-cover rounded-xl" />
              <div className="flex-1">
                <h4 className="font-semibold text-lg">{item.title}</h4>
                <p className="text-sm text-gray-600">Servicio: {item.product?.name || '—'}</p>
                <p className="text-sm text-gray-600">Precio: {item.product?.price || '—'} {item.product?.currency || ''}</p>
                <p className="text-sm text-gray-600">Estado: {item.isActive ? 'Activo' : 'Inactivo'}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    onClick={() => handleToggleActive(item)}
                    disabled={updateMutation.isPending}
                  >
                    {item.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                    onClick={() => openDeleteModal(item)}
                    disabled={deleteMutation.isPending}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
          {galleryItems.length === 0 && <p className="text-gray-500">No hay diseños registrados aún.</p>}
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Confirmar eliminación"
        message={`¿Estás seguro de que deseas eliminar el diseño de inspiración '${itemToDelete?.title ?? ''}'? Esta acción no se puede deshacer.`}
        onConfirm={handleConfirmDelete}
        onCancel={closeDeleteModal}
      />
    </div>
  );
};

export default AdminGallery;
