import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Building2, Users, Calendar, UserCog, LogIn, Trash2 } from 'lucide-react';
import {
  useTenantDetail,
  useTenantActivity,
  useUpdateTenantStatus,
  useDeleteTenant,
  useImpersonateTenant,
  getErrorMessage,
} from '../../hooks/usePlatformQueries';
import type { TenantStatus } from '../../types/superadmin';
import ConfirmModal from '../../components/ConfirmModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const STATUS_LABELS: Record<TenantStatus, string> = {
  ACTIVE: 'Activo',
  TRIAL: 'Prueba',
  SUSPENDED: 'Suspendido',
};

const ACTION_LABELS: Record<string, string> = {
  'tenant.status_change': 'Cambio de estado',
  'tenant.delete': 'Salón eliminado',
  'tenant.impersonate.start': 'Impersonación iniciada',
  'plan.create': 'Plan creado',
  'plan.update': 'Plan actualizado',
  'plan.delete': 'Plan eliminado',
};

const SuperAdminTenantDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pendingStatus, setPendingStatus] = useState<TenantStatus | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmSlugInput, setConfirmSlugInput] = useState('');

  const { data, isLoading } = useTenantDetail(id);
  const { data: activity = [] } = useTenantActivity(id);
  const updateStatus = useUpdateTenantStatus({ onSuccess: () => toast.success('Estado actualizado') });
  const deleteTenant = useDeleteTenant({
    onSuccess: () => {
      toast.success('Salón eliminado');
      navigate('/superadmin/tenants');
    },
  });
  const impersonate = useImpersonateTenant();

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const { tenant, usage } = data;

  const handleConfirmStatusChange = () => {
    if (!pendingStatus || !id) return;
    updateStatus.mutate({ id, status: pendingStatus }, {
      onError: (error) => toast.error(getErrorMessage(error, 'No se pudo actualizar el estado')),
    });
    setPendingStatus(null);
  };

  const handleImpersonate = () => {
    if (!id) return;
    impersonate.mutate(id, {
      onSuccess: (result) => {
        localStorage.setItem('token', result.token);
        window.open('/admin/dashboard', '_blank');
        toast.success('Sesión de impersonación iniciada en una nueva pestaña');
      },
      onError: (error) => toast.error(getErrorMessage(error, 'No se pudo impersonar el salón')),
    });
  };

  const handleDelete = () => {
    if (!id) return;
    deleteTenant.mutate({ id, confirmSlug: confirmSlugInput }, {
      onError: (error) => toast.error(getErrorMessage(error, 'No se pudo eliminar el salón')),
    });
    setShowDeleteDialog(false);
    setConfirmSlugInput('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/superadmin/tenants" className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-white">{tenant.name}</h2>
          <p className="text-sm text-gray-500">{tenant.slug}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Información</h3>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Estado</dt>
                <dd className="text-white mt-1">{STATUS_LABELS[tenant.status]}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Plan</dt>
                <dd className="text-white mt-1">{tenant.platformSubscription?.plan.name ?? 'Sin plan asignado'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Moneda / Zona horaria</dt>
                <dd className="text-white mt-1">{tenant.currency} · {tenant.timezone}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Registrado</dt>
                <dd className="text-white mt-1">{new Date(tenant.createdAt).toLocaleDateString('es')}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-gray-500">Administrador</dt>
                <dd className="text-white mt-1">
                  {tenant.users[0] ? `${tenant.users[0].name} · ${tenant.users[0].email}` : 'Sin usuario administrador'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Uso</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-gray-500" />
                <div><div className="text-white font-semibold">{usage.clientCount}</div><div className="text-gray-500 text-xs">Clientas</div></div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <UserCog className="h-4 w-4 text-gray-500" />
                <div><div className="text-white font-semibold">{usage.staffCount}</div><div className="text-gray-500 text-xs">Profesionales</div></div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-gray-500" />
                <div><div className="text-white font-semibold">{usage.userCount}</div><div className="text-gray-500 text-xs">Usuarios</div></div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-500" />
                <div><div className="text-white font-semibold">{usage.appointmentsThisMonth}</div><div className="text-gray-500 text-xs">Citas este mes</div></div>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Actividad reciente</h3>
            {activity.length === 0 ? (
              <p className="text-sm text-gray-500">Sin actividad registrada todavía.</p>
            ) : (
              <ul className="space-y-3">
                {activity.map((entry) => (
                  <li key={entry.id} className="text-sm border-b border-gray-800/60 pb-3 last:border-0 last:pb-0">
                    <div className="text-gray-200">{ACTION_LABELS[entry.action] ?? entry.action}</div>
                    <div className="text-gray-500 text-xs mt-0.5">
                      {entry.actorEmail ?? entry.actorId} · {new Date(entry.createdAt).toLocaleString('es')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Acciones</h3>
            <button
              onClick={handleImpersonate}
              disabled={impersonate.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition disabled:opacity-50"
            >
              <LogIn className="h-4 w-4" />
              Impersonar salón
            </button>
            {tenant.status !== 'ACTIVE' && (
              <button
                onClick={() => setPendingStatus('ACTIVE')}
                className="w-full px-4 py-2 border border-gray-700 hover:bg-gray-800 text-gray-200 rounded-md text-sm font-medium transition"
              >
                Activar
              </button>
            )}
            {tenant.status !== 'SUSPENDED' && (
              <button
                onClick={() => setPendingStatus('SUSPENDED')}
                className="w-full px-4 py-2 border border-gray-700 hover:bg-gray-800 text-gray-200 rounded-md text-sm font-medium transition"
              >
                Suspender
              </button>
            )}
            {tenant.status !== 'TRIAL' && (
              <button
                onClick={() => setPendingStatus('TRIAL')}
                className="w-full px-4 py-2 border border-gray-700 hover:bg-gray-800 text-gray-200 rounded-md text-sm font-medium transition"
              >
                Marcar como prueba
              </button>
            )}
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-900 hover:bg-red-950 text-red-400 rounded-md text-sm font-medium transition"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar salón
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={pendingStatus !== null}
        title="Cambiar estado del salón"
        message={pendingStatus ? `¿Confirmas cambiar el estado de "${tenant.name}" a "${STATUS_LABELS[pendingStatus]}"?` : ''}
        onConfirm={handleConfirmStatusChange}
        onCancel={() => setPendingStatus(null)}
      />

      <Dialog open={showDeleteDialog} onOpenChange={(open) => { if (!open) { setShowDeleteDialog(false); setConfirmSlugInput(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar salón permanentemente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Esta acción borra <strong>todos</strong> los datos de "{tenant.name}" (clientas, citas, facturas, etc.) y no se puede deshacer.
              Escribe <code className="px-1 py-0.5 bg-muted rounded text-xs">{tenant.slug}</code> para confirmar.
            </p>
            <input
              type="text"
              value={confirmSlugInput}
              onChange={(e) => setConfirmSlugInput(e.target.value)}
              placeholder={tenant.slug}
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <DialogFooter>
            <button
              onClick={() => { setShowDeleteDialog(false); setConfirmSlugInput(''); }}
              className="px-4 py-2 text-sm text-foreground bg-muted rounded-md hover:bg-muted transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={confirmSlugInput !== tenant.slug || deleteTenant.isPending}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Eliminar definitivamente
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminTenantDetail;
