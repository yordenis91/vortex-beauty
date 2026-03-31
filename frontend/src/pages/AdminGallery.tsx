import React, { useState } from 'react';
import type { GalleryItem, Product } from '../types';
import { useProducts, useAdminGalleryItems, useCreateGalleryItem, useUpdateGalleryItem, useDeleteGalleryItem } from '../hooks/useQueries';
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

  const handleDelete = (id: string) => {
    if (!confirm('¿Eliminar este diseño de inspiración?')) return;
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Elemento eliminado');
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

      <form onSubmit={handleCreate} className="bg-white p-5 rounded-lg shadow-md space-y-4">
        <h3 className="text-lg font-semibold">Agregar nuevo diseño</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium">Título</label>
            <input
              className="mt-1 block w-full border-gray-300 rounded-md"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Servicio</label>
            <select
              className="mt-1 block w-full border-gray-300 rounded-md"
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
            <label className="block text-sm font-medium">Imagen</label>
            <input
              type="file"
              accept="image/*"
              className="mt-1"
              onChange={onFileChange}
              required
            />
          </div>
        </div>

        {form.imageUrl && (
          <img src={form.imageUrl} alt="Preview" className="w-40 h-40 object-cover rounded-md" />
        )}

        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              className="h-4 w-4"
            />
            <span className="text-sm">Activo</span>
          </label>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Guardando...' : 'Agregar diseño'}
          </button>
        </div>
      </form>

      <div className="bg-white p-5 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Diseños existentes</h3>

        <div className="grid grid-cols-1 gap-4">
          {galleryItems.map((item) => (
            <div key={item.id} className="border rounded-lg p-4 flex flex-col md:flex-row gap-4 items-start">
              <img src={item.imageUrl} alt={item.title} className="w-full md:w-40 h-28 object-cover rounded" />
              <div className="flex-1">
                <h4 className="font-semibold text-lg">{item.title}</h4>
                <p className="text-sm text-gray-600">Servicio: {item.product?.name || '—'}</p>
                <p className="text-sm text-gray-600">Precio: {item.product?.price || '—'} {item.product?.currency || ''}</p>
                <p className="text-sm text-gray-600">Estado: {item.isActive ? 'Activo' : 'Inactivo'}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    onClick={() => handleToggleActive(item)}
                    disabled={updateMutation.isPending}
                  >
                    {item.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700"
                    onClick={() => handleDelete(item.id)}
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
    </div>
  );
};

export default AdminGallery;
