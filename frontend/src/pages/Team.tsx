import React, { useState } from 'react';
import { Copy, KeyRound, Plus, ShieldCheck, Trash2, UserCheck, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useCreateTeamMember,
  useDeleteTeamMember,
  useProfessionals,
  useResetTeamPassword,
  useTeam,
  useUpdateTeamMember,
} from '../hooks/useQueries';
import { useAuth } from '../contexts/AuthContext';
import { useLabels } from '@/hooks/useLabels';
import ConfirmModal from '../components/ConfirmModal';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getSavedTenantSlug } from '../lib/tenantSlug';
import type { TeamMember } from '../types';

const inputClass = 'w-full px-3 py-2 border border-border rounded-lg bg-card';

/** Datos que se entregan a la persona: se muestran una sola vez. */
interface Credentials {
  name: string;
  email: string;
  password: string;
}

const Team: React.FC = () => {
  const { user: me } = useAuth();
  const { label, the } = useLabels();
  const { data: team = [], isLoading } = useTeam();
  const { data: professionals = [] } = useProfessionals();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'STAFF' as 'ADMIN' | 'STAFF', professionalId: '' });
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [toDelete, setToDelete] = useState<TeamMember | null>(null);

  const roleName = (m: TeamMember) =>
    m.role === 'OWNER' ? 'Dueño' : m.role === 'ADMIN' ? 'Gerente' : label('professional', true);

  const withoutAccount = professionals.filter((p) => !p.user && !p.userId);

  const create = useCreateTeamMember({
    onSuccess: ({ user, tempPassword }) => {
      setShowForm(false);
      setForm({ name: '', email: '', role: 'STAFF', professionalId: '' });
      setCredentials({ name: user.name, email: user.email, password: tempPassword });
    },
  });
  const update = useUpdateTeamMember();
  const reset = useResetTeamPassword();
  const remove = useDeleteTeamMember({ onSuccess: () => { toast.success('Usuario eliminado'); setToDelete(null); } });

  const accessText = (c: Credentials) =>
    `Acceso a ${window.location.origin}/${getSavedTenantSlug()}/login\nCorreo: ${c.email}\nContraseña temporal: ${c.password}\nCámbiala en Mi perfil al entrar.`;

  const copy = async (c: Credentials) => {
    try {
      await navigator.clipboard.writeText(accessText(c));
      toast.success('Datos copiados');
    } catch {
      toast.error('No se pudo copiar. Selecciona el texto y cópialo.');
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      ...(form.role === 'STAFF' && { professionalId: form.professionalId }),
    });
  };

  const onReset = (m: TeamMember) =>
    reset.mutate(m.id, { onSuccess: ({ tempPassword }) => setCredentials({ name: m.name, email: m.email, password: tempPassword }) });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Equipo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Las personas que entran al panel. El gerente administra el salón; {the('professional')} solo ve su propia agenda.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center justify-center px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-5 w-5 mr-2" /> Nuevo usuario
        </button>
      </div>

      <div className="bg-card shadow overflow-hidden sm:rounded-md">
        {isLoading ? (
          <div className="p-6 text-muted-foreground">Cargando...</div>
        ) : (
          <ul className="divide-y divide-border">
            {team.map((m) => {
              const isMe = m.id === me?.id;
              const locked = m.role === 'OWNER';
              return (
                <li key={m.id} className="px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground flex flex-wrap items-center gap-2">
                      <span className="truncate">{m.name}</span>
                      {isMe && <span className="text-xs text-muted-foreground">(tú)</span>}
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{roleName(m)}</span>
                      {!m.isActive && <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs">Desactivado</span>}
                    </div>
                    <div className="text-xs text-muted-foreground break-all">{m.email}</div>
                  </div>
                  {!locked && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => onReset(m)} disabled={reset.isPending} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                        <KeyRound className="h-4 w-4" /> Restablecer contraseña
                      </button>
                      <button type="button" onClick={() => update.mutate({ id: m.id, isActive: !m.isActive })} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                        {m.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        {m.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                      <button type="button" onClick={() => setToDelete(m)} aria-label={`Eliminar a ${m.name}`} className="inline-flex items-center rounded-md border border-border px-2.5 py-1.5 text-sm text-red-600 hover:bg-muted">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Nuevo usuario</DialogTitle>
            <DialogDescription>Se crea con una contraseña temporal que verás una sola vez.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label htmlFor="team-role" className="block text-sm font-medium mb-1">Tipo de acceso</label>
              <select id="team-role" className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'ADMIN' | 'STAFF' })}>
                <option value="STAFF">{label('professional', true)} (solo ve su agenda)</option>
                <option value="ADMIN">Gerente (administra el salón)</option>
              </select>
            </div>
            {form.role === 'STAFF' && (
              <div>
                <label htmlFor="team-pro" className="block text-sm font-medium mb-1">{label('professional', true)}</label>
                {withoutAccount.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Todos tus {label('professionals')} ya tienen acceso. Crea primero la ficha en {label('professionals', true)}.
                  </p>
                ) : (
                  <select id="team-pro" required className={inputClass} value={form.professionalId} onChange={(e) => {
                    const pro = withoutAccount.find((p) => p.id === e.target.value);
                    setForm({ ...form, professionalId: e.target.value, name: form.name || pro?.name || '', email: form.email || pro?.email || '' });
                  }}>
                    <option value="">Elige uno</option>
                    {withoutAccount.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
              </div>
            )}
            <div>
              <label htmlFor="team-name" className="block text-sm font-medium mb-1">Nombre</label>
              <input id="team-name" required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label htmlFor="team-email" className="block text-sm font-medium mb-1">Correo</label>
              <input id="team-email" type="email" required className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-md">Cancelar</button>
              <button type="submit" disabled={create.isPending || (form.role === 'STAFF' && !form.professionalId)} className="px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                Crear usuario
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!credentials} onOpenChange={(open) => { if (!open) setCredentials(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Datos de acceso de {credentials?.name}</DialogTitle>
            <DialogDescription>Compártelos por un canal privado. La contraseña no se vuelve a mostrar.</DialogDescription>
          </DialogHeader>
          {credentials && (
            <div className="space-y-3">
              <pre className="whitespace-pre-wrap break-all rounded-lg bg-muted p-3 text-sm select-all">{accessText(credentials)}</pre>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setCredentials(null)} className="px-4 py-2 border border-border rounded-md">Cerrar</button>
                <button type="button" onClick={() => copy(credentials)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700">
                  <Copy className="h-4 w-4" /> Copiar datos
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={!!toDelete}
        title="Eliminar usuario"
        message={`¿Eliminar a ${toDelete?.name}? Perderá el acceso. Si ya registró clientes o servicios, desactívalo en su lugar.`}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
};

export default Team;
