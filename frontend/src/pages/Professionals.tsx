import React, { useState } from 'react';
import {
  useProfessionals,
  useCreateProfessional,
  useUpdateProfessional,
  useDeleteProfessional,
  useServices,
  useTimeOff,
  useCreateTimeOff,
  useDeleteTimeOff,
} from '../hooks/useQueries';
import type { Professional, ScheduleBlock } from '../types';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Plus, Edit, Trash2, Search, CalendarOff, KeyRound } from 'lucide-react';

const DAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

const inputClass =
  'w-full px-3 py-2 border border-border rounded-lg bg-card focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  color: '#3B82F6',
  isActive: true,
  acceptsOnlineBookings: true,
  schedule: [] as ScheduleBlock[],
  serviceIds: [] as string[],
  accountEmail: '',
  accountPassword: '',
};

function TimeOffPanel({ professionalId }: { professionalId: string }) {
  const { data: timeOffs = [] } = useTimeOff(professionalId);
  const [range, setRange] = useState({ from: '', to: '', reason: '' });
  const create = useCreateTimeOff({ onSuccess: () => { toast.success('Ausencia registrada'); setRange({ from: '', to: '', reason: '' }); } });
  const remove = useDeleteTimeOff({ onSuccess: () => toast.success('Ausencia eliminada') });

  const submit = async (force = false) => {
    if (!range.from || !range.to) return toast.error('Indica desde y hasta');
    try {
      await create.mutateAsync({
        professionalId,
        startsAt: new Date(`${range.from}T00:00:00`).toISOString(),
        endsAt: new Date(`${range.to}T23:59:59`).toISOString(),
        reason: range.reason || undefined,
        force,
      });
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { error?: string } } };
      if (err.response?.status === 409 && window.confirm(`${err.response.data?.error}\n\n¿Registrar la ausencia de todos modos?`)) {
        void submit(true);
      }
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <CalendarOff className="h-4 w-4" /> Ausencias (vacaciones, descansos)
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input type="date" aria-label="Desde" className={inputClass} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <input type="date" aria-label="Hasta" className={inputClass} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        <input type="text" placeholder="Motivo (opcional)" className={inputClass} value={range.reason} onChange={(e) => setRange({ ...range, reason: e.target.value })} />
        <button type="button" onClick={() => void submit()} className="px-3 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700">
          Añadir
        </button>
      </div>
      <ul className="text-sm divide-y divide-border">
        {timeOffs.map((t) => (
          <li key={t.id} className="flex items-center justify-between py-1">
            <span>
              {new Date(t.startsAt).toLocaleDateString('es')} → {new Date(t.endsAt).toLocaleDateString('es')}
              {t.reason ? ` · ${t.reason}` : ''}
            </span>
            <button type="button" onClick={() => remove.mutate(t.id)} className="text-red-600 p-1" aria-label="Eliminar ausencia">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {timeOffs.length === 0 && <li className="py-1 text-muted-foreground">Sin ausencias registradas.</li>}
      </ul>
    </div>
  );
}

const Professionals: React.FC = () => {
  const { role } = useAuth();
  const isOwner = role === 'OWNER';
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Professional | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const { data: professionals = [], isLoading: loading } = useProfessionals();
  const { data: services = [] } = useServices();
  const createProfessional = useCreateProfessional({ onSuccess: () => toast.success('Profesional creado correctamente') });
  const updateProfessional = useUpdateProfessional({ onSuccess: () => toast.success('Profesional actualizado correctamente') });
  const deleteProfessional = useDeleteProfessional({ onSuccess: () => toast.success('Profesional eliminado correctamente') });

  const filtered = professionals.filter(
    (p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setFormData({
      ...emptyForm,
      // Horario inicial de lunes a viernes; se ajusta después
      schedule: [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startTime: '09:00', endTime: '18:00' })),
      serviceIds: services.filter((s) => s.status === 'ACTIVE').map((s) => s.id),
    });
    setShowModal(true);
  };

  const openEdit = (p: Professional) => {
    setEditing(p);
    setFormData({
      name: p.name,
      email: p.email ?? '',
      phone: p.phone ?? '',
      color: p.color ?? '#3B82F6',
      isActive: p.isActive,
      acceptsOnlineBookings: p.acceptsOnlineBookings,
      schedule: (p.schedules ?? []).map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })),
      serviceIds: p.serviceIds ?? [],
      accountEmail: '',
      accountPassword: '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setFormData(emptyForm);
  };

  const blocksOf = (day: number) =>
    formData.schedule.map((b, index) => ({ ...b, index })).filter((b) => b.dayOfWeek === day);

  const updateBlock = (index: number, patch: Partial<ScheduleBlock>) =>
    setFormData({ ...formData, schedule: formData.schedule.map((b, i) => (i === index ? { ...b, ...patch } : b)) });

  const buildPayload = () => ({
    name: formData.name,
    email: formData.email,
    phone: formData.phone || undefined,
    color: formData.color,
    isActive: formData.isActive,
    acceptsOnlineBookings: formData.acceptsOnlineBookings,
    schedule: formData.schedule,
    serviceIds: formData.serviceIds,
    ...(formData.accountEmail && formData.accountPassword
      ? { account: { email: formData.accountEmail, password: formData.accountPassword } }
      : {}),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateProfessional.mutateAsync({ id: editing.id, professionalData: buildPayload() });
      } else {
        await createProfessional.mutateAsync(buildPayload());
      }
      closeModal();
    } catch (error) {
      console.error('Error saving professional:', error);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteProfessional.mutateAsync(itemToDelete);
    } finally {
      setItemToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold leading-7 text-foreground sm:text-3xl">Profesionales</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quién atiende, cuándo trabaja y qué servicios realiza. Cada profesional tiene su propia agenda.
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <button onClick={openCreate} className="inline-flex items-center px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
            <Plus className="h-5 w-5 mr-2" />
            Agregar profesional
          </button>
        </div>
      </div>

      <div className="bg-card shadow rounded-lg px-4 py-5 sm:p-6">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar profesionales..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-border rounded-md bg-card"
          />
        </div>
      </div>

      <div className="bg-card shadow overflow-hidden sm:rounded-md">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground">
            <Users className="mx-auto h-12 w-12" />
            <h3 className="mt-2 text-sm font-medium text-foreground">Sin profesionales</h3>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((p) => (
              <li key={p.id} className="px-4 py-4 sm:px-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="h-8 w-8 rounded-full shrink-0" style={{ backgroundColor: p.color || '#3B82F6' }} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {p.name} {!p.isActive && <span className="text-xs text-muted-foreground">(inactivo)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[p.email, p.phone].filter(Boolean).join(' · ') || 'Sin contacto'}
                      {' · '}
                      {(p.serviceIds ?? []).length} servicios
                      {p.user ? ' · con acceso' : ''}
                      {!p.acceptsOnlineBookings ? ' · sin reserva en línea' : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(p)} className="p-2 text-blue-600 hover:bg-muted rounded-md" aria-label="Editar">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button onClick={() => setItemToDelete(p.id)} className="p-2 text-red-600 hover:bg-muted rounded-md" aria-label="Eliminar">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar profesional' : 'Nuevo profesional'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input required className={inputClass} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Color en la agenda</label>
                <input type="color" className="h-10 w-full rounded-lg border border-border bg-card" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Correo</label>
                <input type="email" className={inputClass} value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Teléfono</label>
                <input className={inputClass} value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} />
                Activo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={formData.acceptsOnlineBookings} onChange={(e) => setFormData({ ...formData, acceptsOnlineBookings: e.target.checked })} />
                Acepta reservas en línea
              </label>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Horario semanal</h4>
              <div className="space-y-2">
                {DAYS.map((day) => (
                  <div key={day.value} className="flex flex-wrap items-center gap-2">
                    <span className="w-24 text-sm">{day.label}</span>
                    {blocksOf(day.value).length === 0 && <span className="text-xs text-muted-foreground">No trabaja</span>}
                    {blocksOf(day.value).map((b) => (
                      <span key={b.index} className="inline-flex items-center gap-1">
                        <input type="time" aria-label="Desde" className="px-2 py-1 border border-border rounded bg-card" value={b.startTime} onChange={(e) => updateBlock(b.index, { startTime: e.target.value })} />
                        <span>–</span>
                        <input type="time" aria-label="Hasta" className="px-2 py-1 border border-border rounded bg-card" value={b.endTime} onChange={(e) => updateBlock(b.index, { endTime: e.target.value })} />
                        <button type="button" aria-label="Quitar tramo" className="text-red-600 px-1" onClick={() => setFormData({ ...formData, schedule: formData.schedule.filter((_, i) => i !== b.index) })}>
                          ×
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      className="text-xs text-blue-600"
                      onClick={() => setFormData({ ...formData, schedule: [...formData.schedule, { dayOfWeek: day.value, startTime: '09:00', endTime: '18:00' }] })}
                    >
                      + tramo
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Servicios que realiza</h4>
              <div className="flex flex-wrap gap-2">
                {services.map((svc) => {
                  const checked = formData.serviceIds.includes(svc.id);
                  return (
                    <label key={svc.id} className={`text-sm px-3 py-1 rounded-full border cursor-pointer ${checked ? 'bg-blue-50 border-blue-300 text-blue-800' : 'border-border'}`}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() =>
                          setFormData({
                            ...formData,
                            serviceIds: checked ? formData.serviceIds.filter((id) => id !== svc.id) : [...formData.serviceIds, svc.id],
                          })
                        }
                      />
                      {svc.name}
                    </label>
                  );
                })}
                {services.length === 0 && <p className="text-xs text-muted-foreground">Primero crea servicios.</p>}
              </div>
            </div>

            {isOwner && !editing?.user && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <KeyRound className="h-4 w-4" /> Acceso al panel (opcional)
                </h4>
                <p className="text-xs text-muted-foreground">Con una cuenta, el profesional inicia sesión y ve solo su propia agenda.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input type="email" placeholder="Correo de acceso" className={inputClass} value={formData.accountEmail} onChange={(e) => setFormData({ ...formData, accountEmail: e.target.value })} />
                  <input type="password" placeholder="Contraseña (mín. 8)" minLength={8} className={inputClass} value={formData.accountPassword} onChange={(e) => setFormData({ ...formData, accountPassword: e.target.value })} />
                </div>
              </div>
            )}

            {editing && <TimeOffPanel professionalId={editing.id} />}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="px-4 py-2 border border-border rounded-md">Cancelar</button>
              <button type="submit" className="px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700">Guardar</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={itemToDelete !== null}
        title="Eliminar profesional"
        message="¿Seguro que quieres eliminar a este profesional? Si tiene citas registradas, desactívalo en su lugar."
        onConfirm={confirmDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
};

export default Professionals;
