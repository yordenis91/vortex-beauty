import React, { useState } from 'react';
import { useClients, useCreateClient, useUpdateClient, useDeleteClient } from '../hooks/useQueries';
import { Users, Plus, Edit, Trash2, Search, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';

// Tipado rápido para el componente
interface Client {
  id: string;
  name: string;
  email: string;
  code?: string;
  displayName?: string;
  type?: 'CUSTOMER' | 'SUPPLIER';
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  groupId?: string;
  ownerId?: string;
  taxId?: string;
  imageUrl?: string;
}

interface ClientFormData {
  name: string;
  email: string;
  code: string;
  displayName: string;
  type: 'CUSTOMER' | 'SUPPLIER';
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  groupId: string;
  ownerId: string;
  taxId: string;
  imageUrl: string;
  username: string;
  password: string;
  confirmPassword: string;
  sendWelcomeEmail: boolean;
}

const Clients: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<ClientFormData>({
    name: '',
    email: '',
    code: '',
    displayName: '',
    type: 'CUSTOMER',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    groupId: '',
    ownerId: '',
    taxId: '',
    imageUrl: '',
    username: '',
    password: '',
    confirmPassword: '',
    sendWelcomeEmail: false,
  });

  // Usar hooks centralizados
  const { data: clients = [], isLoading } = useClients();
  const createMutation = useCreateClient({
    onSuccess: () => toast.success('Cliente creado correctamente'),
  });
  const updateMutation = useUpdateClient({
    onSuccess: () => toast.success('Cliente actualizado correctamente'),
  });
  const deleteMutation = useDeleteClient({
    onSuccess: () => toast.success('Cliente eliminado correctamente'),
  });

  // Funciones de UI
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      code: '',
      displayName: '',
      type: 'CUSTOMER',
      phone: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
      groupId: '',
      ownerId: '',
      taxId: '',
      imageUrl: '',
      username: '',
      password: '',
      confirmPassword: '',
      sendWelcomeEmail: false,
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
      code: client.code || '',
      displayName: client.displayName || '',
      type: client.type || 'CUSTOMER',
      phone: client.phone || '',
      address: client.address || '',
      city: client.city || '',
      state: client.state || '',
      zipCode: client.zipCode || '',
      country: client.country || '',
      groupId: client.groupId || '',
      ownerId: client.ownerId || '',
      taxId: client.taxId || '',
      imageUrl: client.imageUrl || '',
      username: '',
      password: '',
      confirmPassword: '',
      sendWelcomeEmail: false,
    });
    setShowModal(true);
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setFormData({ ...formData, imageUrl: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validación básica para contraseña (solo crea, no edit)
    if (!editingClient && formData.password) {
      if (formData.password !== formData.confirmPassword) {
        toast.error('Password y Confirm Password deben coincidir');
        return;
      }
    }

    const payload = {
      name: formData.name,
      email: formData.email,
      code: formData.code || undefined,
      displayName: formData.displayName || undefined,
      type: formData.type,
      phone: formData.phone || undefined,
      address: formData.address || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      zipCode: formData.zipCode || undefined,
      country: formData.country || undefined,
      groupId: formData.groupId || undefined,
      ownerId: formData.ownerId || undefined,
      taxId: formData.taxId || undefined,
      imageUrl: formData.imageUrl || undefined,
    };

    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, clientData: payload });
    } else {
      createMutation.mutate({
        ...payload,
        username: formData.username || undefined,
        password: formData.password || undefined,
        sendWelcomeEmail: formData.sendWelcomeEmail,
      });
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Clientes</h2>
          <p className="mt-1 text-sm text-gray-500">Gestiona tu cartera de clientes</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nuevo Cliente
        </button>
      </div>

      {/* Buscador */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Tabla / Lista (Expandida) */}
      <div className="bg-white shadow-sm border border-gray-100 rounded-lg flex-1 overflow-hidden">
        {filteredClients.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Users className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p>No se encontraron clientes.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filteredClients.map((client) => (
              <li key={client.id} className="p-4 hover:bg-gray-50 flex justify-between items-center transition">
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-4">
                    <p className="font-medium text-gray-900">{client.name}</p>
                    <div className="flex space-x-4 text-sm text-gray-500 mt-1">
                      <span className="flex items-center"><Mail className="h-4 w-4 mr-1" /> {client.email}</span>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => openEdit(client)} className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50">
                    <Edit className="h-5 w-5" />
                  </button>
                  <button onClick={() => handleDelete(client.id)} className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal Minimalista */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 transition-opacity flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-semibold">{editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                  <input type="text" value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as 'CUSTOMER' | 'SUPPLIER'})} className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="CUSTOMER">Customer</option>
                    <option value="SUPPLIER">Supplier</option>
                  </select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Ubicación</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State/Region</label>
                    <input type="text" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ZIP/Postal Code</label>
                    <input type="text" value={formData.zipCode} onChange={e => setFormData({...formData, zipCode: e.target.value})} className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <select value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="">Seleccione país</option>
                      <option value="USA">USA</option>
                      <option value="CAN">Canada</option>
                      <option value="MEX">Mexico</option>
                      <option value="ESP">España</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Profile Image</label>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Credenciales de Acceso</h4>
                {!editingClient && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                        <input type="password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div className="flex items-end">
                        <label className="inline-flex items-center text-sm text-gray-700">
                          <input type="checkbox" checked={formData.sendWelcomeEmail} onChange={e => setFormData({...formData, sendWelcomeEmail: e.target.checked})} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                          <span className="ml-2">Enviar correo de bienvenida</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex items-center mt-3">
                      <input type="checkbox" checked={formData.sendWelcomeEmail} onChange={e => setFormData({...formData, sendWelcomeEmail: e.target.checked})} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                      <label className="ml-2 text-sm text-gray-700">Enviar correo de bienvenida</label>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md">Cancelar</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                  {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <ConfirmModal
        isOpen={itemToDelete !== null}
        title="Eliminar Cliente"
        message="¿Estás seguro de que quieres eliminar este cliente? Esta acción no se puede deshacer."
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
};

export default Clients;