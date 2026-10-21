import React, { useState, useEffect } from 'react';
import type { Service } from '../types';
import { useServices, useCategories, useCreateService, useUpdateService, useDeleteService, useProfessionals, useResources, useBookingSettings } from '../hooks/useQueries';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import Pagination from '../components/Pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Plus, Edit, Trash2, Search, DollarSign, Clock, Eye, EyeOff } from 'lucide-react';
import { useLabels } from '@/hooks/useLabels';

const ITEMS_PER_PAGE = 10;

const emptyForm = {
  name: '',
  description: '',
  price: '',
  currency: 'USD',
  categoryId: '',
  isPublic: true,
  onlineBookable: true,
  status: 'ACTIVE' as Service['status'],
  durationMinutes: '60',
  bufferBeforeMin: '0',
  bufferAfterMin: '0',
  professionalIds: [] as string[],
  resourceIds: [] as string[],
};

const inputClass =
  'w-full px-4 py-2 border border-border rounded-lg bg-card focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition';

function CheckList({
  label,
  items,
  selected,
  onChange,
  emptyText,
}: {
  label: string;
  items: Array<{ id: string; name: string }>;
  selected: string[];
  onChange: (ids: string[]) => void;
  emptyText: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => {
            const checked = selected.includes(item.id);
            return (
              <label
                key={item.id}
                className={`flex items-center gap-2 text-sm px-3 py-1 rounded-full border cursor-pointer ${checked ? 'bg-blue-50 border-blue-300 text-blue-800' : 'border-border'}`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => onChange(checked ? selected.filter((id) => id !== item.id) : [...selected, item.id])}
                />
                {item.name}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

const Services: React.FC = () => {
  const { label, the } = useLabels();
  const { data: settings } = useBookingSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterVisibility, setFilterVisibility] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const { data: services = [], isLoading: servicesLoading } = useServices();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: professionals = [] } = useProfessionals();
  const { data: resources = [] } = useResources();
  const createService = useCreateService({ onSuccess: () => toast.success('Servicio creado correctamente') });
  const updateService = useUpdateService({ onSuccess: () => toast.success('Servicio actualizado correctamente') });
  const deleteService = useDeleteService({ onSuccess: () => toast.success('Servicio eliminado correctamente') });

  const loading = servicesLoading || categoriesLoading;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCategory, filterVisibility]);

  const filteredServices = services.filter((service) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      service.name.toLowerCase().includes(term) ||
      service.description?.toLowerCase().includes(term) ||
      service.category?.name.toLowerCase().includes(term);
    const matchesCategory = filterCategory === 'ALL' || service.categoryId === filterCategory;
    const matchesVisibility =
      filterVisibility === 'ALL' || (filterVisibility === 'PUBLIC' ? service.isPublic : !service.isPublic);
    return matchesSearch && matchesCategory && matchesVisibility;
  });

  const totalPages = Math.ceil(filteredServices.length / ITEMS_PER_PAGE);
  const paginatedServices = filteredServices.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const buildPayload = () => ({
    name: formData.name,
    description: formData.description || undefined,
    price: parseFloat(formData.price),
    currency: formData.currency,
    categoryId: formData.categoryId,
    isPublic: formData.isPublic,
    onlineBookable: formData.onlineBookable,
    status: formData.status,
    durationMinutes: parseInt(formData.durationMinutes) || 60,
    bufferBeforeMin: parseInt(formData.bufferBeforeMin) || 0,
    bufferAfterMin: parseInt(formData.bufferAfterMin) || 0,
    professionalIds: formData.professionalIds,
    resourceIds: formData.resourceIds,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categoryId) {
      toast.error('Por favor selecciona una categoría');
      return;
    }
    try {
      await createService.mutateAsync(buildPayload());
      setShowCreateModal(false);
      setFormData(emptyForm);
    } catch (error) {
      console.error('Error creating service:', error);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    try {
      await updateService.mutateAsync({ id: editingService.id, serviceData: buildPayload() });
      setEditingService(null);
      setFormData(emptyForm);
    } catch (error) {
      console.error('Error updating service:', error);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteService.mutateAsync(itemToDelete);
    } finally {
      setItemToDelete(null);
    }
  };

  // Un servicio nuevo lo realizan, por defecto, todos los profesionales activos.
  const openCreateModal = () => {
    setFormData({ ...emptyForm, currency: settings?.currency ?? emptyForm.currency, professionalIds: professionals.filter((p) => p.isActive).map((p) => p.id) });
    setShowCreateModal(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      price: service.price.toString(),
      currency: service.currency,
      categoryId: service.categoryId,
      isPublic: service.isPublic,
      onlineBookable: service.onlineBookable,
      status: service.status,
      durationMinutes: service.durationMinutes?.toString() || '60',
      bufferBeforeMin: String(service.bufferBeforeMin ?? 0),
      bufferAfterMin: String(service.bufferAfterMin ?? 0),
      professionalIds: service.professionalIds ?? [],
      resourceIds: service.resourceIds ?? [],
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const isOpen = showCreateModal || editingService !== null;
  const closeModal = () => {
    setShowCreateModal(false);
    setEditingService(null);
    setFormData(emptyForm);
  };

  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate">
            Servicios
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Los servicios que {the('customers')} pueden reservar.</p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-5 w-5 mr-2" />
            Agregar servicio
          </button>
        </div>
      </div>

      <div className="bg-card shadow rounded-lg px-4 py-5 sm:p-6 flex flex-col lg:flex-row gap-4">
        <div className="relative min-w-0 lg:flex-1">
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
        {filteredServices.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground">
            <Package className="mx-auto h-12 w-12" />
            <h3 className="mt-2 text-sm font-medium text-foreground">Sin servicios</h3>
            <p className="mt-1 text-sm">Crea tu primer servicio para empezar a recibir reservas.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {paginatedServices.map((service) => (
              <li key={service.id} className="px-4 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">{service.name}</div>
                  <div className="text-sm text-muted-foreground">{service.category?.name}</div>
                  {service.description && <div className="text-sm text-muted-foreground mt-1">{service.description}</div>}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center"><DollarSign className="h-4 w-4 mr-1" />{service.price} {service.currency}</span>
                    <span className="flex items-center"><Clock className="h-4 w-4 mr-1" />{service.durationMinutes} min</span>
                    <span className="flex items-center">
                      {service.isPublic ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
                      {service.isPublic ? 'Visible' : 'Oculto'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEditModal(service)} className="p-2 text-blue-600 hover:bg-muted rounded-md" aria-label="Editar">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button onClick={() => setItemToDelete(service.id)} className="p-2 text-red-600 hover:bg-muted rounded-md" aria-label="Eliminar">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {totalPages > 1 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filteredServices.length} itemsPerPage={ITEMS_PER_PAGE} />
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingService ? 'Editar servicio' : 'Nuevo servicio'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={editingService ? handleEdit : handleCreate} className="space-y-4">
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Preparación antes (min)</label>
                <input type="number" min="0" step="5" className={inputClass} value={formData.bufferBeforeMin} onChange={(e) => setFormData({ ...formData, bufferBeforeMin: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Limpieza después (min)</label>
                <input type="number" min="0" step="5" className={inputClass} value={formData.bufferAfterMin} onChange={(e) => setFormData({ ...formData, bufferAfterMin: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Estado</label>
              <select className={inputClass} value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as Service['status'] })}>
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo (no se puede reservar)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={formData.isPublic} onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })} />
                Visible para los clientes
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={formData.onlineBookable} onChange={(e) => setFormData({ ...formData, onlineBookable: e.target.checked })} />
                Se puede reservar en línea
              </label>
            </div>
            <CheckList
              label="Lo realizan"
              emptyText={`Aún no hay ${label('professionals')}.`}
              items={professionals.filter((p) => p.isActive).map((p) => ({ id: p.id, name: p.name }))}
              selected={formData.professionalIds}
              onChange={(professionalIds) => setFormData({ ...formData, professionalIds })}
            />
            {resources.length > 0 && (
              <CheckList
                label="Recursos que necesita (uno libre de ellos)"
                emptyText=""
                items={resources.filter((r) => r.isActive).map((r) => ({ id: r.id, name: r.name }))}
                selected={formData.resourceIds}
                onChange={(resourceIds) => setFormData({ ...formData, resourceIds })}
              />
            )}
            <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-3 border-t border-border bg-popover px-6 py-3">
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

export default Services;
