import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { Calendar } from '@/components/ui/calendar';
import { apiErrorMessage, publicApi, type ManageView, type PublicSlot } from '../../lib/publicApi';
import PublicShell from './PublicShell';
import TelegramOptIn from './TelegramOptIn';
import { money } from './format';
import { Spinner } from './shared';

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente de confirmar',
  SCHEDULED: 'Confirmada',
  COMPLETED: 'Realizada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No asististe',
};

/** Enlace secreto de la confirmación: ver, cambiar de hora o cancelar sin cuenta. */
const ManageBooking: React.FC = () => {
  const { tenantSlug = '', token = '' } = useParams<{ tenantSlug: string; token: string }>();
  const base = `/${tenantSlug}/manage/${token}`;
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'view' | 'reschedule' | 'confirmCancel'>('view');
  const [date, setDate] = useState<Date | undefined>();
  const [error, setError] = useState('');

  const view = useQuery({
    queryKey: ['public-manage', tenantSlug, token],
    queryFn: async () => (await publicApi.get<ManageView>(base)).data,
    retry: false,
  });

  const dateStr = date ? format(date, 'yyyy-MM-dd') : '';
  const slots = useQuery({
    queryKey: ['public-manage-slots', tenantSlug, token, dateStr],
    queryFn: async () => (await publicApi.get<{ slots: PublicSlot[] }>(`${base}/availability`, { params: { date: dateStr } })).data.slots,
    enabled: mode === 'reschedule' && !!dateStr,
  });

  const onDone = (data: ManageView) => {
    queryClient.setQueryData(['public-manage', tenantSlug, token], data);
    setMode('view');
    setDate(undefined);
    setError('');
  };
  const cancel = useMutation({
    mutationFn: async () => (await publicApi.post<ManageView>(`${base}/cancel`, {})).data,
    onSuccess: onDone,
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const reschedule = useMutation({
    mutationFn: async (startTime: string) => (await publicApi.post<ManageView>(`${base}/reschedule`, { date: dateStr, startTime })).data,
    onSuccess: onDone,
    onError: (err) => setError(apiErrorMessage(err)),
  });

  if (view.isLoading) return <PublicShell title="Mi reserva"><Spinner /></PublicShell>;
  if (view.isError || !view.data) {
    return (
      <PublicShell title="Mi reserva">
        <p className="text-center text-muted-foreground py-12">Este enlace no es válido o ya venció. Si necesitas ayuda, contacta al negocio.</p>
      </PublicShell>
    );
  }

  const { appointment: a, salonName, canCancel, canReschedule, cancelWindowHrs, telegram } = view.data;
  const day = cap(format(new Date(`${a.date.split('T')[0]}T00:00:00`), "EEEE d 'de' MMMM", { locale: es }));
  const today = startOfDay(new Date());
  const active = a.status === 'SCHEDULED' || a.status === 'PENDING';

  return (
    <PublicShell title={salonName} subtitle="Tu reserva">
      <section className="bg-card rounded-2xl border border-border p-5 space-y-2">
        <span
          className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${
            a.status === 'CANCELLED' ? 'bg-red-50 text-red-700' : active ? 'bg-green-50 text-green-700' : 'bg-muted text-muted-foreground'
          }`}
        >
          {STATUS_LABEL[a.status]}
        </span>
        <div className="text-lg font-semibold text-foreground">{a.serviceName}</div>
        <div className="text-muted-foreground">{day} · {a.startTime}–{a.endTime}</div>
        {a.professionalName && <div className="text-muted-foreground">Con {a.professionalName}</div>}
        <div className="text-muted-foreground">{money(a.priceAmount, a.currency)}</div>
      </section>

      {active && <TelegramOptIn telegram={telegram} />}

      {error && <div role="alert" className="rounded-xl bg-red-50 text-red-800 px-4 py-3 text-sm border border-red-200">{error}</div>}

      {active && !canCancel && (
        <p className="text-sm text-muted-foreground bg-card rounded-xl border border-border p-4">
          Los cambios y cancelaciones se hacen hasta {cancelWindowHrs} horas antes. Para cualquier cambio ahora, contacta directamente al negocio.
        </p>
      )}

      {mode === 'view' && active && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            disabled={!canReschedule}
            onClick={() => { setMode('reschedule'); setError(''); }}
            className="py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cambiar fecha u hora
          </button>
          <button
            disabled={!canCancel}
            onClick={() => { setMode('confirmCancel'); setError(''); }}
            className="py-3 rounded-xl border border-red-300 text-red-700 font-semibold hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancelar reserva
          </button>
        </div>
      )}

      {mode === 'confirmCancel' && (
        <section className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <p className="text-foreground">¿Seguro que quieres cancelar esta reserva?</p>
          <div className="flex gap-3">
            <button onClick={() => setMode('view')} className="flex-1 py-3 rounded-xl border border-border">No, mantenerla</button>
            <button
              onClick={() => cancel.mutate()}
              disabled={cancel.isPending}
              className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {cancel.isPending ? 'Cancelando…' : 'Sí, cancelar'}
            </button>
          </div>
        </section>
      )}

      {mode === 'reschedule' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Elige el nuevo día y hora</h2>
          <div className="bg-card rounded-2xl border border-border p-3 overflow-x-auto">
            <Calendar
              mode="single"
              locale={es}
              selected={date}
              onSelect={setDate}
              disabled={(d) => isBefore(startOfDay(d), today) || d > addDays(today, 120)}
              className="w-full min-w-[17rem]"
            />
          </div>
          {date && (
            slots.isLoading ? (
              <Spinner />
            ) : (slots.data ?? []).length === 0 ? (
              <p className="text-center text-muted-foreground">No hay horarios ese día.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.data!.map((s) => (
                  <button
                    key={s.startTime}
                    disabled={reschedule.isPending}
                    onClick={() => reschedule.mutate(s.startTime)}
                    className="py-3 rounded-xl border border-border bg-card font-medium hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-50"
                  >
                    {s.startTime}
                  </button>
                ))}
              </div>
            )
          )}
          <button onClick={() => setMode('view')} className="w-full py-3 rounded-xl border border-border">Volver</button>
        </section>
      )}
    </PublicShell>
  );
};

export default ManageBooking;
