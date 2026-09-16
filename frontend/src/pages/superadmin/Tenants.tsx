import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Building2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTenants, usePlans, useUpdateTenantStatus, getErrorMessage } from '../../hooks/usePlatformQueries';
import type { TenantStatus } from '../../types/superadmin';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const STATUS_STYLES: Record<TenantStatus, string> = {
  ACTIVE: 'bg-emerald-950 text-emerald-400 border-emerald-900',
  TRIAL: 'bg-amber-950 text-amber-400 border-amber-900',
  SUSPENDED: 'bg-red-950 text-red-400 border-red-900',
};

const STATUS_LABELS: Record<TenantStatus, string> = {
  ACTIVE: 'Activo',
  TRIAL: 'Prueba',
  SUSPENDED: 'Suspendido',
};

const StatusBadge: React.FC<{ status: TenantStatus }> = ({ status }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status]}`}>
    {STATUS_LABELS[status]}
  </span>
);

const SuperAdminTenants: React.FC = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TenantStatus | ''>('');
  const [planId, setPlanId] = useState('');
  const [page, setPage] = useState(1);

  const { data: plans = [] } = usePlans();
  const { data, isLoading } = useTenants({
    search: search || undefined,
    status: status || undefined,
    planId: planId || undefined,
    page,
    pageSize: 20,
  });

  const updateStatus = useUpdateTenantStatus({
    onSuccess: () => toast.success('Estado del salón actualizado'),
  });

  const handleStatusChange = (id: string, newStatus: TenantStatus) => {
    updateStatus.mutate({ id, status: newStatus }, {
      onError: (error) => toast.error(getErrorMessage(error, 'No se pudo actualizar el estado')),
    });
  };

  const tenants = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Salones (Tenants)</h2>
        <p className="mt-1 text-sm text-gray-400">Administra todos los salones suscritos a la plataforma</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, slug o email del admin..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as TenantStatus | ''); setPage(1); }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activo</option>
          <option value="TRIAL">Prueba</option>
          <option value="SUSPENDED">Suspendido</option>
        </select>
        <select
          value={planId}
          onChange={(e) => { setPlanId(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todos los planes</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>{plan.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
          </div>
        ) : tenants.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <Building2 className="mx-auto h-10 w-10 mb-3" />
            No se encontraron salones con estos filtros.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400">
                <th className="px-4 py-3 font-medium">Salón</th>
                <th className="px-4 py-3 font-medium">Admin</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Clientas</th>
                <th className="px-4 py-3 font-medium">Registrado</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="border-b border-gray-800/60 hover:bg-gray-800/40">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{tenant.name}</div>
                    <div className="text-gray-500 text-xs">{tenant.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{tenant.users[0]?.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-300">{tenant.platformSubscription?.plan.name ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={tenant.status} /></td>
                  <td className="px-4 py-3 text-gray-300">{tenant._count.clients}</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(tenant.createdAt).toLocaleDateString('es')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/superadmin/tenants/${tenant.id}`}
                        className="p-2 text-gray-400 hover:text-indigo-400 hover:bg-gray-800 rounded-md transition"
                        title="Ver detalle"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="px-3 py-1.5 text-xs border border-gray-700 rounded-md text-gray-300 hover:bg-gray-800 transition">
                            Cambiar estado
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => handleStatusChange(tenant.id, 'ACTIVE')} disabled={tenant.status === 'ACTIVE'}>
                            Activar
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleStatusChange(tenant.id, 'SUSPENDED')} disabled={tenant.status === 'SUSPENDED'}>
                            Suspender
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleStatusChange(tenant.id, 'TRIAL')} disabled={tenant.status === 'TRIAL'}>
                            Marcar como prueba
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Página {pagination.page} de {pagination.totalPages} ({pagination.total} salones)</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 border border-gray-700 rounded-md disabled:opacity-40 hover:bg-gray-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="p-2 border border-gray-700 rounded-md disabled:opacity-40 hover:bg-gray-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminTenants;
