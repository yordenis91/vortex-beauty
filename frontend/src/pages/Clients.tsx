import { compressImage } from '../lib/image';
import React, { useState } from 'react';
import { useClients, useCreateClient, useUpdateClient, useDeleteClient } from '../hooks/useQueries';
import { Users, Plus, Edit, Trash2, Search, Mail, Phone, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLabels } from '@/hooks/useLabels';

// Tipado rápido para el componente
interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  imageUrl?: string;
}

interface ClientFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  imageUrl: string;
}

const Clients: React.FC = () => {
  const { label, agree, the } = useLabels();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<ClientFormData>({
    name: '',
    email: '',
    phone: '',
    address: '',
    imageUrl: '',
  });

  // Usar hooks centralizados
  const { data: clients = [], isLoading } = useClients();
  const createMutation = useCreateClient({
    onSuccess: () => toast.success(`Se creó ${the('customer')}`),
  });
  const updateMutation = useUpdateClient({
    onSuccess: () => toast.success(`Se actualizó ${the('customer')}`),
  });
  const deleteMutation = useDeleteClient({
    onSuccess: () => toast.success(`Se eliminó ${the('customer')}`),
  });

  // Funciones de UI
  const filteredClients = clients.filter((c) => {
    const term = searchTerm.toLowerCase();
    return c.name.toLowerCase().includes(term) || (c.email ?? '').toLowerCase().includes(term) || (c.phone ?? '').includes(searchTerm);
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      imageUrl: '',
    });
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingClient(null);
    resetForm();
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email,
      phone: client.phone || '',
      address: client.address || '',
      imageUrl: client.imageUrl || '',
    });
    setShowModal(true);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      compressImage(file)
        .then((base64) => setFormData((prev) => ({ ...prev, imageUrl: base64 })))
        .catch(() => toast.error('No se pudo procesar la imagen'));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone || undefined,
      address: formData.address || undefined,
      imageUrl: formData.imageUrl || undefined,
    };

    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, clientData: payload });
    } else {
      createMutation.mutate(payload);
    }

    closeModal();
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      await deleteMutation.mutateAsync(itemToDelete);
    } catch (error) {
      console.error('Error deleting record:', error);
    } finally {
      setItemToDelete(null);
    }
  };

  const cancelDelete = () => {
    setItemToDelete(null);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{label('customers', true)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Gestiona tu cartera de {label('customers')}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          <Plus className="h-5 w-5 mr-2" />
          {agree('Nuev', 'customer')} {label('customer')}
        </button>
      </div>

      {/* Buscador */}
      <div className="bg-card p-4 rounded-lg shadow-sm border border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Grid de Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {filteredClients.length === 0 ? (
          <div className="col-span-full bg-card rounded-lg shadow-sm border border-border px-4 py-12 text-center text-muted-foreground">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p>No se encontraron {label('customers')}.</p>
          </div>
        ) : (
          filteredClients.map((client) => (
            <div key={client.id} className="bg-card rounded-xl shadow-sm border border-border p-4 flex items-start gap-3 transition hover:shadow-md">
              <div className="h-11 w-11 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg shrink-0">
                {client.name.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-foreground line-clamp-2 break-words">{client.name}</h3>
                <div className="mt-1 space-y-1">
                  {client.email && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Mail className="h-4 w-4 shrink-0 mr-2" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 shrink-0 mr-2" />
                      <span className="truncate">{client.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex shrink-0">
                <button onClick={() => openEdit(client)} aria-label="Editar" className="p-2 text-muted-foreground hover:text-blue-600 rounded-full hover:bg-blue-50 transition">
                  <Edit className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(client.id)} aria-label="Eliminar" className="p-2 text-muted-foreground hover:text-red-600 rounded-full hover:bg-red-50 transition">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Premium SaaS */}
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingClient ? `Editar ${label('customer')}` : `Crear ${agree('nuev', 'customer')} ${label('customer')}`}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Avatar Section */}
            <div className="flex justify-center mb-8">
              <label className="cursor-pointer group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <div className="w-24 h-24 rounded-full bg-muted border-2 border-dashed border-border group-hover:border-blue-500 transition flex items-center justify-center relative overflow-hidden">
                  {formData.imageUrl ? (
                    <img
                      src={formData.imageUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground group-hover:text-blue-500 transition">
                      <Camera className="h-8 w-8 mb-1" />
                      <span className="text-xs">Foto</span>
                    </div>
                  )}
                </div>
                <p className="text-center text-xs text-muted-foreground mt-2 group-hover:text-blue-600 transition">Haz clic para cambiar</p>
              </label>
            </div>

            {/* Información Personal Section */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4 pb-3 border-b border-border">
                Información Personal
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Nombre Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="Ej: María García"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="maria@example.com"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="+53 5 555 1234"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="Calle y número"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-3 border-t border-border bg-popover px-6 py-3">
              <button
                type="button"
                onClick={closeModal}
                className="px-6 py-2 text-foreground bg-muted rounded-lg hover:bg-muted transition font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {(createMutation.isPending || updateMutation.isPending) ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      
      <ConfirmModal
        isOpen={itemToDelete !== null}
        title={`Eliminar ${label('customer')}`}
        message={`¿Estás seguro de que quieres eliminar ${the('customer')}? Esta acción no se puede deshacer.`}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

export default Clients;