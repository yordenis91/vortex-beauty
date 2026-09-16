import React, { useState } from 'react';
import { Plus, Edit, Trash2, Layers, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan, getErrorMessage } from '../../hooks/usePlatformQueries';
import type { Plan, CreatePlanRequest } from '../../types/superadmin';
import ConfirmModal from '../../components/ConfirmModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const emptyForm: CreatePlanRequest = {
  name: '',
  slug: '',
  description: '',
  priceMonthly: 0,
  priceYearly: 0,
  currency: 'USD',
  trialDays: 0,
  maxStaff: null,
  maxAppointmentsPerMonth: null,
  maxLocations: null,
  features: [],
  isActive: true,
  isPublic: true,
  sortOrder: 0,
};

const SuperAdminPlans: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [featuresInput, setFeaturesInput] = useState('');
  const [formData, setFormData] = useState<CreatePlanRequest>(emptyForm);

  const { data: plans = [], isLoading } = usePlans();
  const createMutation = useCreatePlan({ onSuccess: () => toast.success('Plan creado correctamente') });
  const updateMutation = useUpdatePlan({ onSuccess: () => toast.success('Plan actualizado correctamente') });
  const deleteMutation = useDeletePlan({ onSuccess: () => toast.success('Plan eliminado') });

  const closeModal = () => {
    setShowModal(false);
    setEditingPlan(null);
    setFormData(emptyForm);
    setFeaturesInput('');
  };

  const openCreate = () => {
    setEditingPlan(null);
    setFormData(emptyForm);
    setFeaturesInput('');
    setShowModal(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      slug: plan.slug,
      description: plan.description ?? '',
      priceMonthly: Number(plan.priceMonthly),
      priceYearly: Number(plan.priceYearly),
      currency: plan.currency,
      trialDays: plan.trialDays,
      maxStaff: plan.maxStaff ?? null,
      maxAppointmentsPerMonth: plan.maxAppointmentsPerMonth ?? null,
      maxLocations: plan.maxLocations ?? null,
      features: plan.features,
      isActive: plan.isActive,
      isPublic: plan.isPublic,
      sortOrder: plan.sortOrder,
    });
    setFeaturesInput(plan.features.join(', '));
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CreatePlanRequest = {
      ...formData,
      features: featuresInput.split(',').map((f) => f.trim()).filter(Boolean),
    };

    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data: payload }, {
        onError: (error) => toast.error(getErrorMessage(error, 'No se pudo actualizar el plan')),
      });
    } else {
      createMutation.mutate(payload, {
        onError: (error) => toast.error(getErrorMessage(error, 'No se pudo crear el plan')),
      });
    }
    closeModal();
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteMutation.mutateAsync(itemToDelete);
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo eliminar el plan'));
    } finally {
      setItemToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Planes</h2>
          <p className="mt-1 text-sm text-gray-400">Catálogo de planes que la plataforma vende a los salones</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition text-sm font-medium"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.length === 0 ? (
          <div className="col-span-full bg-gray-900 border border-gray-800 rounded-xl py-16 text-center text-gray-500">
            <Layers className="mx-auto h-10 w-10 mb-3" />
            No hay planes todavía.
          </div>
        ) : (
          plans.map((plan) => (
            <div key={plan.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <span className={`text-xs ${plan.isActive ? 'text-emerald-400' : 'text-gray-500'}`}>
                    {plan.isActive ? 'Activo' : 'Inactivo'} {plan._count ? `· ${plan._count.tenantSubscriptions} salón(es)` : ''}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(plan)} className="p-1.5 text-gray-400 hover:text-indigo-400 hover:bg-gray-800 rounded-md transition">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button onClick={() => setItemToDelete(plan.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-md transition">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <p className="text-sm text-gray-400 mb-4 flex-1">{plan.description}</p>

              <div className="text-2xl font-bold text-white mb-1">
                ${Number(plan.priceMonthly).toFixed(0)}<span className="text-sm font-normal text-gray-500">/mes</span>
              </div>
              <div className="text-xs text-gray-500 mb-4">${Number(plan.priceYearly).toFixed(0)}/año · {plan.trialDays} días de prueba</div>

              <ul className="space-y-1.5 text-sm text-gray-300 mb-4">
                <li>{plan.maxStaff ?? 'Ilimitados'} profesionales</li>
                <li>{plan.maxAppointmentsPerMonth ?? 'Ilimitadas'} citas/mes</li>
                <li>{plan.maxLocations ?? 'Ilimitadas'} sedes</li>
              </ul>

              {plan.features.length > 0 && (
                <ul className="space-y-1 border-t border-gray-800 pt-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-xs text-gray-400">
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </div>

      <Dialog open={showModal} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Editar Plan' : 'Crear Nuevo Plan'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Nombre *</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Slug *</label>
                <input
                  required
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                  placeholder="pro"
                  className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Descripción</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Precio mensual *</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.priceMonthly}
                  onChange={(e) => setFormData({ ...formData, priceMonthly: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Precio anual *</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.priceYearly}
                  onChange={(e) => setFormData({ ...formData, priceYearly: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Días de prueba</label>
                <input
                  type="number"
                  min="0"
                  value={formData.trialDays}
                  onChange={(e) => setFormData({ ...formData, trialDays: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Máx. profesionales</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Ilimitado"
                  value={formData.maxStaff ?? ''}
                  onChange={(e) => setFormData({ ...formData, maxStaff: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Máx. citas/mes</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Ilimitado"
                  value={formData.maxAppointmentsPerMonth ?? ''}
                  onChange={(e) => setFormData({ ...formData, maxAppointmentsPerMonth: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Máx. sedes</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Ilimitado"
                  value={formData.maxLocations ?? ''}
                  onChange={(e) => setFormData({ ...formData, maxLocations: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Features (separadas por coma)</label>
              <input
                type="text"
                value={featuresInput}
                onChange={(e) => setFeaturesInput(e.target.value)}
                placeholder="notificaciones_whatsapp, reportes_avanzados"
                className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4"
                />
                Activo
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  className="h-4 w-4"
                />
                Visible públicamente
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-foreground bg-muted rounded-md hover:bg-muted transition flex items-center gap-1">
                <X className="h-4 w-4" /> Cancelar
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-6 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition disabled:opacity-50"
              >
                {(createMutation.isPending || updateMutation.isPending) ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={itemToDelete !== null}
        title="Eliminar Plan"
        message="¿Estás seguro de que quieres eliminar este plan? Esta acción no se puede deshacer."
        onConfirm={confirmDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
};

export default SuperAdminPlans;
