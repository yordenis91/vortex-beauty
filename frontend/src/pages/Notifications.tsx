import React, { useState } from 'react';
import { Mail, MessageSquare, CheckCircle, Clock, AlertCircle, RotateCw, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { useRetryNotification, useSendLog, type SendLogFilters } from '../hooks/useQueries';
import type { NotificationStatus, SendLogItem } from '../types';
import { useLabels } from '@/hooks/useLabels';

const selectClass = 'rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-blue-500 outline-none';

const STATUS_CARDS: Array<{ status: NotificationStatus; label: string; tone: string }> = [
  { status: 'PENDING', label: 'Pendientes', tone: 'text-yellow-600' },
  { status: 'SENT', label: 'Enviadas', tone: 'text-green-600' },
  { status: 'FAILED', label: 'Con error', tone: 'text-red-600' },
];

const CHANNEL_LABEL: Record<string, string> = { EMAIL: 'Correo', TELEGRAM: 'Telegram', WHATSAPP: 'WhatsApp', SYSTEM: 'Sistema' };

const ChannelIcon = ({ type }: { type: string }) =>
  type === 'EMAIL' ? <Mail className="h-5 w-5 text-blue-600" aria-hidden /> : <MessageSquare className="h-5 w-5 text-sky-600" aria-hidden />;

function StatusBadge({ status }: { status: NotificationStatus }) {
  const base = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium';
  if (status === 'PENDING')
    return (
      <span className={`${base} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200`}>
        <Clock className="h-3 w-3 mr-1" aria-hidden />
        Pendiente
      </span>
    );
  if (status === 'SENT')
    return (
      <span className={`${base} bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200`}>
        <CheckCircle className="h-3 w-3 mr-1" aria-hidden />
        Enviado
      </span>
    );
  return (
    <span className={`${base} bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200`}>
      <AlertCircle className="h-3 w-3 mr-1" aria-hidden />
      Error
    </span>
  );
}

const formatDate = (value: string) => {
  try {
    return format(parseISO(value), 'dd MMM yyyy HH:mm', { locale: es });
  } catch {
    return value;
  }
};

/** Registro de envíos: los correos y mensajes de Telegram que Afilao mandó a clientas y al equipo, con filtros y reintento. */
const Notifications: React.FC = () => {
  const { label } = useLabels();
  const [filters, setFilters] = useState<SendLogFilters>({ page: 1 });
  const { data, isLoading, isError } = useSendLog(filters);
  const retry = useRetryNotification();
  const [retrying, setRetrying] = useState<string | null>(null);

  const change = (patch: Partial<SendLogFilters>) => setFilters((f) => ({ ...f, ...patch, page: 1 }));
  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const from = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.page * data.pageSize, data.total) : 0;

  const onRetry = (item: SendLogItem) => {
    setRetrying(item.id);
    retry.mutate(item.id, {
      onSuccess: (result) => (result === 'sent' ? toast.success('Enviado.') : toast.error('Sigue fallando. Revisa el motivo del error.')),
      onSettled: () => setRetrying(null),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold leading-7 text-foreground sm:truncate">Registro de envíos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Correos y mensajes de Telegram que Afilao mandó a {label('customers')} y al equipo. Se conservan 90 días. Las novedades de reservas están en la campanita de arriba.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {STATUS_CARDS.map(({ status, label: text, tone }) => {
          const active = filters.status === status;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              onClick={() => change({ status: active ? undefined : status })}
              className={`rounded-lg bg-card p-3 text-left shadow sm:p-6 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'ring-2 ring-blue-500' : ''}`}
            >
              <span className={`block text-sm font-medium ${tone}`}>{text}</span>
              <span className={`mt-1 block text-2xl font-bold sm:mt-2 sm:text-3xl ${tone}`}>{data ? data.counts[status] : '–'}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-foreground">
          Canal
          <select className={selectClass} value={filters.channel ?? ''} onChange={(e) => change({ channel: (e.target.value || undefined) as SendLogFilters['channel'] })}>
            <option value="">Todos</option>
            <option value="EMAIL">Correo</option>
            <option value="TELEGRAM">Telegram</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          Para
          <select className={selectClass} value={filters.audience ?? ''} onChange={(e) => change({ audience: (e.target.value || undefined) as SendLogFilters['audience'] })}>
            <option value="">Todos</option>
            <option value="CLIENTS">{label('customers', true)}</option>
            <option value="TEAM">Dueño y equipo</option>
          </select>
        </label>
        {(filters.status || filters.channel || filters.audience) && (
          <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => setFilters({ page: 1 })}>
            Quitar filtros
          </button>
        )}
      </div>

      <div className="bg-card rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64" role="status" aria-label="Cargando">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : isError && !data ? (
          <p role="alert" className="py-12 text-center text-muted-foreground">
            No se pudo cargar el registro de envíos.
          </p>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <Send className="h-12 w-12 text-muted-foreground mx-auto mb-4" aria-hidden />
            <p className="text-muted-foreground text-lg">{filters.status || filters.channel || filters.audience ? 'Ningún envío coincide con estos filtros' : 'Aún no hay envíos'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  {['Fecha', 'Canal', 'Destinatario', 'Mensaje', 'Estado'].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-foreground">{formatDate(item.createdAt)}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <ChannelIcon type={item.type} />
                        <span className="text-sm font-medium text-foreground">{CHANNEL_LABEL[item.type] ?? item.type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <p className="font-medium text-foreground">{item.client ? item.client.name : 'Dueño o equipo'}</p>
                      <p className="text-xs text-muted-foreground">{item.recipient}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-foreground max-w-[11rem]">
                      <p className="truncate" title={item.content}>
                        {item.content}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={item.status} />
                      {item.status === 'FAILED' && item.errorLog && <p className="mt-1 max-w-48 text-xs text-red-600 dark:text-red-400">{item.errorLog}</p>}
                      {item.retryable && (
                        <button
                          type="button"
                          onClick={() => onRetry(item)}
                          disabled={retrying === item.id}
                          aria-label={`Reintentar envío a ${item.recipient}`}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                        >
                          <RotateCw className={`h-3.5 w-3.5 ${retrying === item.id ? 'animate-spin' : ''}`} aria-hidden />
                          {retrying === item.id ? 'Reintentando…' : 'Reintentar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > data.pageSize && (
          <nav aria-label="Paginación" className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <span>
              {from}–{to} de {data.total}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={data.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))} className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-muted disabled:opacity-50">
                Anterior
              </button>
              <span>
                Página {data.page} de {totalPages}
              </span>
              <button type="button" disabled={data.page >= totalPages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))} className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-muted disabled:opacity-50">
                Siguiente
              </button>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
};

export default Notifications;
