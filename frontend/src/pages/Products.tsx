import React, { useState, useEffect } from 'react';
import type { Product } from '../types';
import { useProducts, useCategories, useCreateProduct, useUpdateProduct, useDeleteProduct } from '../hooks/useQueries';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import Pagination from '../components/Pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Plus, Edit, Trash2, Search, DollarSign, Clock, Eye, EyeOff } from 'lucide-react';

const ITEMS_PER_PAGE = 10;

const emptyForm = {
  name: '',
  description: '',
  price: '',
  currency: 'USD',
  categoryId: '',
  isPublic: true,
  durationMinutes: '60',
};

const inputClass =
  'w-full px-4 py-2 border border-border rounded-lg bg-card focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition';

const Products: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterVisibility, setFilterVisibility] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const createProduct = useCreateProduct({ onSuccess: () => toast.success('Servicio creado correctamente') });
  const updateProduct = useUpdateProduct({ onSuccess: () => toast.success('Servicio actualizado correctamente') });
  const deleteProduct = useDeleteProduct({ onSuccess: () => toast.success('Servicio eliminado correctamente') });

  const loading = productsLoading || categoriesLoading;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCategory, filterVisibility]);

  const filteredProducts = products.filter((product) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      product.name.toLowerCase().includes(term) ||
      product.description?.toLowerCase().includes(term) ||
      product.category?.name.toLowerCase().includes(term);
    const matchesCategory = filterCategory === 'ALL' || product.categoryId === filterCategory;
    const matchesVisibility =
      filterVisibility === 'ALL' || (filterVisibility === 'PUBLIC' ? product.isPublic : !product.isPublic);
    return matchesSearch && matchesCategory && matchesVisibility;
  });

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const buildPayload = () => ({
    name: formData.name,
    description: formData.description || undefined,
    price: parseFloat(formData.price),
    currency: formData.currency,
    categoryId: formData.categoryId,
    isPublic: formData.isPublic,
    durationMinutes: parseInt(formData.durationMinutes) || 60,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categoryId) {
      toast.error('Por favor selecciona una categoría');
      return;
    }
    try {
      await createProduct.mutateAsync(buildPayload());
      setShowCreateModal(false);
      setFormData(emptyForm);
    } catch (error) {
      console.error('Error creating product:', error);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      await updateProduct.mutateAsync({ id: editingProduct.id, productData: buildPayload() });
      setEditingProduct(null);
      setFormData(emptyForm);
    } catch (error) {
      console.error('Error updating product:', error);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteProduct.mutateAsync(itemToDelete);
    } finally {
      setItemToDelete(null);
    }
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      currency: product.currency,
      categoryId: product.categoryId,
      isPublic: product.isPublic,
      durationMinutes: product.durationMinutes?.toString() || '60',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const isOpen = showCreateModal || editingProduct !== null;
  const closeModal = () => {
    setShowCreateModal(false);
    setEditingProduct(null);
    setFormData(emptyForm);
  };

  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
            Servicios
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Los servicios que tus clientes pueden reservar.</p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-5 w-5 mr-2" />
            Agregar servicio
          </button>
        </div>
      </div>

      <div className="bg-card shadow rounded-lg px-4 py-5 sm:p-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar servicios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-border rounded-md bg-card"
          />
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-3 py-2 border border-border rounded-md bg-card">
          <option value="ALL">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={filterVisibility} onChange={(e) => setFilterVisibility(e.target.value)} className="px-3 py-2 border border-border rounded-md bg-card">
          <option value="ALL">Toda visibilidad</option>
          <option value="PUBLIC">Públicos</option>
          <option value="HIDDEN">Ocultos</option>
        </select>
      </div>

      <div className="bg-card shadow overflow-hidden sm:rounded-md">
        {filteredProducts.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground">
            <Package className="mx-auto h-12 w-12" />
            <h3 className="mt-2 text-sm font-medium text-foreground">Sin servicios</h3>
            <p className="mt-1 text-sm">Crea tu primer servicio para empezar a recibir reservas.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {paginatedProducts.map((product) => (
              <li key={product.id} className="px-4 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">{product.name}</div>
                  <div className="text-sm text-muted-foreground">{product.category?.name}</div>
                  {product.description && <div className="text-sm text-muted-foreground mt-1">{product.description}</div>}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center"><DollarSign className="h-4 w-4 mr-1" />{product.price} {product.currency}</span>
                    <span className="flex items-center"><Clock className="h-4 w-4 mr-1" />{product.durationMinutes} min</span>
                    <span className="flex items-center">
                      {product.isPublic ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
                      {product.isPublic ? 'Visible' : 'Oculto'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEditModal(product)} className="p-2 text-blue-600 hover:bg-muted rounded-md" aria-label="Editar">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button onClick={() => setItemToDelete(product.id)} className="p-2 text-red-600 hover:bg-muted rounded-md" aria-label="Eliminar">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {totalPages > 1 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filteredProducts.length} itemsPerPage={ITEMS_PER_PAGE} />
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editar servicio' : 'Nuevo servicio'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={editingProduct ? handleEdit : handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre *</label>
              <input required className={inputClass} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Descripción</label>
              <textarea rows={2} className={inputClass} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Precio *</label>
                <input required type="number" min="0" step="0.01" className={inputClass} value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Duración (min) *</label>
                <input required type="number" min="5" step="5" className={inputClass} value={formData.durationMinutes} onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Categoría *</label>
              <select required className={inputClass} value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}>
                <option value="">Selecciona una categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formData.isPublic} onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })} />
              Visible para reservar
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="px-4 py-2 border border-border rounded-md">Cancelar</button>
              <button type="submit" className="px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700">Guardar</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={itemToDelete !== null}
        onConfirm={confirmDelete}
        onCancel={() => setItemToDelete(null)}
        title="Eliminar servicio"
        message="¿Seguro que quieres eliminar este servicio?"
      />
    </div>
  );
};

export default Products;
