import React, { useState } from 'react';
import { useStaff, useCreateStaff, useUpdateStaff, useDeleteStaff } from '../hooks/useQueries';
import type { Staff as StaffMember } from '../types';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Search,
} from 'lucide-react';

const Staff: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    color: '#3B82F6',
    isActive: true,
  });

  const { data: staff = [], isLoading: loading } = useStaff();
  const createStaff = useCreateStaff({
    onSuccess: () => toast.success('Profesional creado correctamente'),
  });
  const updateStaff = useUpdateStaff({
    onSuccess: () => toast.success('Profesional actualizado correctamente'),
  });
  const deleteStaff = useDeleteStaff({
    onSuccess: () => toast.success('Profesional eliminado correctamente'),
  });

  const filteredStaff = staff.filter((member) =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData({ name: '', email: '', phone: '', color: '#3B82F6', isActive: true });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createStaff.mutateAsync(formData);
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      console.error('Error creating staff member:', error);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    try {
      await updateStaff.mutateAsync({ id: editingStaff.id, staffData: formData });
      setEditingStaff(null);
      resetForm();
    } catch (error) {
      console.error('Error updating staff member:', error);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteStaff.mutateAsync(itemToDelete);
    } catch (error) {
      console.error('Error deleting staff member:', error);
    } finally {
      setItemToDelete(null);
    }
  };

  const openEditModal = (member: StaffMember) => {
    setEditingStaff(member);
    setFormData({
      name: member.name,
      email: member.email || '',
      phone: member.phone || '',
      color: member.color || '#3B82F6',
      isActive: member.isActive,
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
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl sm:tracking-tight">
            Profesionales
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona las manicuristas del salón. Asignar un profesional a una cita es opcional e informativo — el horario del salón sigue siendo general.
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-5 w-5 mr-2" />
            Agregar Profesional
          </button>
        </div>
      </div>

      <div className="bg-card shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
              type="text"
              placeholder="Buscar profesionales..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-border rounded-md leading-5 bg-card placeholder:text-muted-foreground focus:outline-none focus:placeholder:text-muted-foreground focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStaff.length === 0 ? (
          <div className="col-span-full bg-card rounded-lg shadow px-4 py-8 text-center text-muted-foreground">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium text-foreground">Sin profesionales</h3>
            <p className="mt-1 text-sm text-muted-foreground">Agrega a la primera manicurista del equipo.</p>
            <div className="mt-6">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-5 w-5 mr-2" />
                Agregar Profesional
              </button>
            </div>
          </div>
        ) : (
          filteredStaff.map((member) => (
            <div key={member.id} className="bg-card rounded-lg shadow overflow-hidden">
              <div className="h-3" style={{ backgroundColor: member.color || '#3B82F6' }}></div>
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium text-foreground">{member.name}</h3>
                      {!member.isActive && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                          Inactivo
                        </span>
                      )}
                    </div>
                    {member.email && <p className="mt-1 text-sm text-muted-foreground">{member.email}</p>}
                    {member.phone && <p className="text-sm text-muted-foreground">{member.phone}</p>}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openEditModal(member)}
                      className="p-1 rounded-full text-muted-foreground hover:text-muted-foreground hover:bg-muted"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setItemToDelete(member.id)}
                      className="p-1 rounded-full text-muted-foreground hover:text-red-500 hover:bg-muted"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog
        open={showCreateModal || !!editingStaff}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateModal(false);
            setEditingStaff(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStaff ? 'Editar Profesional' : 'Agregar Profesional'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={editingStaff ? handleEdit : handleCreate} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="Nombre de la manicurista"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Teléfono</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Color en la agenda</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="h-10 w-14 border border-border rounded-lg"
                    />
                    <span className="text-sm text-muted-foreground">{formData.color}</span>
                  </div>
                </div>
                <label className="flex items-center gap-2 pb-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-border text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-foreground">Activo</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingStaff(null);
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
                  {editingStaff ? 'Actualizar' : 'Crear'} Profesional
                </button>
              </div>
            </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={itemToDelete !== null}
        title="Eliminar Profesional"
        message="¿Estás segura de que quieres eliminar a este profesional? Si tiene citas asociadas, desactívalo en su lugar."
        onConfirm={confirmDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
};

export default Staff;
