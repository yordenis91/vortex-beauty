import React, { useState } from 'react';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '../hooks/useQueries';
import type { Category } from '../types';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Folder,
  Plus,
  Edit,
  Trash2,
  Search
} from 'lucide-react';

const Categories: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'PRODUCT' as Category['type'],
    color: '#3B82F6',
    icon: 'folder',
    order: 0,
  });

  // Use React Query hooks
  const { data: categories = [], isLoading: loading } = useCategories();
  const createCategory = useCreateCategory({
    onSuccess: () => toast.success('Categoría creada correctamente'),
  });
  const updateCategory = useUpdateCategory({
    onSuccess: () => toast.success('Categoría actualizada correctamente'),
  });
  const deleteCategory = useDeleteCategory({
    onSuccess: () => toast.success('Categoría eliminada correctamente'),
  });

  const filteredCategories = categories.filter(category => {
    const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         category.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !typeFilter || category.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'PRODUCT',
      color: '#3B82F6',
      icon: 'folder',
      order: 0,
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCategory.mutateAsync(formData);
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error('Error creando la categoría');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      await updateCategory.mutateAsync({ id: editingCategory.id, categoryData: formData });
      setEditingCategory(null);
      resetForm();
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Error actualizando la categoría');
    }
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      await deleteCategory.mutateAsync(itemToDelete);
    } catch (error) {
      console.error('Error deleting record:', error);
    } finally {
      setItemToDelete(null);
    }
  };

  const cancelDelete = () => {
    setItemToDelete(null);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      type: category.type,
      color: category.color || '#3B82F6',
      icon: category.icon || 'folder',
      order: category.order,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
            Categorías
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Organice sus productos, servicios, y articulos de la base de conocimiento en categorías para una mejor gestión y navegación.
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-5 w-5 mr-2" />
            Agregar Categoría
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <input
                type="text"
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-border rounded-md leading-5 bg-card placeholder:text-muted-foreground focus:outline-none focus:placeholder:text-muted-foreground focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="block w-full border border-border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Types</option>
              <option value="PRODUCT">Products</option>
              <option value="TICKET">Tickets</option>
              <option value="KNOWLEDGE_BASE">Knowledge Base</option>
            </select>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCategories.length === 0 ? (
          <div className="col-span-full bg-card rounded-lg shadow px-4 py-8 text-center text-muted-foreground">
            <Folder className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium text-foreground">No categories</h3>
            <p className="mt-1 text-sm text-muted-foreground">Get started by creating a new category.</p>
            <div className="mt-6">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Category
              </button>
            </div>
          </div>
        ) : (
          filteredCategories.map((category) => (
            <div key={category.id} className="bg-card rounded-lg shadow overflow-hidden">
              <div
                className="h-3"
                style={{ backgroundColor: category.color || '#3B82F6' }}
              ></div>
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-foreground">
                      {category.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Type: {category.type.replace('_', ' ')}
                    </p>
                    {category.description && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {category.description}
                      </p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openEditModal(category)}
                      className="p-1 rounded-full text-muted-foreground hover:text-muted-foreground hover:bg-muted"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="p-1 rounded-full text-muted-foreground hover:text-red-500 hover:bg-muted"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {category._count && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {category._count.products}
                        </p>
                        <p className="text-xs text-muted-foreground">Products</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {category._count.tickets}
                        </p>
                        <p className="text-xs text-muted-foreground">Tickets</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {category._count.articles}
                        </p>
                        <p className="text-xs text-muted-foreground">Articles</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog
        open={showCreateModal || !!editingCategory}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateModal(false);
            setEditingCategory(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Categoría' : 'Agregar Nueva Categoría'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? 'Actualiza los datos de la categoría.'
                : 'Crea una nueva categoría para organizar tu contenido.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editingCategory ? handleEdit : handleCreate} className="space-y-8">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-4 pb-3 border-b border-border">
                  Detalles de la categoría
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Nombre de la categoría"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Tipo <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as Category['type'] })}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    >
                      <option value="PRODUCT">Products</option>
                      <option value="TICKET">Tickets</option>
                      <option value="KNOWLEDGE_BASE">Knowledge Base</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Descripción
                    </label>
                    <textarea
                      placeholder="Descripción de la categoría"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-4 pb-3 border-b border-border">
                  Configuración visual
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Color
                    </label>
                    <div className="mt-1 flex items-center gap-3">
                      <input
                        type="color"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="h-10 w-14 border border-border rounded-lg"
                      />
                      <span className="text-sm text-muted-foreground">{formData.color}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Orden
                    </label>
                    <input
                      type="number"
                      value={formData.order}
                      onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingCategory(null);
                    resetForm();
                  }}
                  className="px-6 py-2 text-foreground bg-muted rounded-lg hover:bg-muted transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingCategory ? 'Actualizar' : 'Crear'} Categoría
                </button>
              </div>
            </form>
        </DialogContent>
      </Dialog>
      
      <ConfirmModal
        isOpen={itemToDelete !== null}
        title="Eliminar Categoría"
        message="¿Estás seguro de que quieres eliminar esta categoría? Esta acción no se puede deshacer."
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

export default Categories;