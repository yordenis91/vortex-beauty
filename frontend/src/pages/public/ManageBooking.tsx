import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale/es';
import LazyCalendar from './LazyCalendar';
import { apiErrorMessage, publicApi, type ManageView, type PublicSlot } from '../../lib/publicApi';
import PublicShell from './PublicShell';
import TelegramOptIn from './TelegramOptIn';
import AddToCalendar from '../../components/AddToCalendar';
import { money } from './format';
import { ConnectionProblem, LoadingPage, Spinner, StaleNotice } from './shared';
import { errorKind, publicRetry } from '../../lib/publicConnectivity';
import { fingerprint, readSaved, save } from '../../lib/publicCache';

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

  // La última vista correcta se guarda en el dispositivo (sin el enlace ni el vínculo de Telegram, que son secretos):
  // así la clienta puede ver su reserva aunque no tenga internet.
  const cacheKey = `manage:${tenantSlug}:${fingerprint(token)}`;
  const remember = (data: ManageView) => save(cacheKey, { ...data, telegram: null, appointment: { ...data.appointment, manageUrl: null, telegram: null } });
  const [saved] = useState(() => readSaved<ManageView>(cacheKey));
  const view = useQuery({
    queryKey: ['public-manage', tenantSlug, token],
    queryFn: async () => {
      const fresh = (await publicApi.get<ManageView>(base)).data;
      remember(fresh);
      return fresh;
    },
    initialData: saved?.value,
    initialDataUpdatedAt: saved?.savedAt,
    // Al abrir siempre se pide el estado real; lo guardado se ve mientras tanto (o si no hay conexión).
    staleTime: 0,
    ...publicRetry,
  });
  // Solo un 404 dice que el enlace no vale; sin conexión o con el servidor caído se sigue mostrando lo guardado.
  const failureKind = view.isError ? errorKind(view.error) : null;
  const invalidLink = failureKind === 'not-found' || failureKind === 'other';

  const dateStr = date ? format(date, 'yyyy-MM-dd') : '';
  const slots = useQuery({
    queryKey: ['public-manage-slots', tenantSlug, token, dateStr],
    queryFn: async () => (await publicApi.get<{ slots: PublicSlot[] }>(`${base}/availability`, { params: { date: dateStr } })).data.slots,
    enabled: mode === 'reschedule' && !!dateStr,
    ...publicRetry,
  });

  const onDone = (data: ManageView) => {
    queryClient.setQueryData(['public-manage', tenantSlug, token], data);
    remember(data);
    setMode('view');
    setDate(undefined);
    setError('');
  };
  // Si la conexión se cortó no se sabe si la acción llegó a hacerse: se avisa y se vuelve a comprobar el estado real.
  const onActionError = (err: unknown, done: string) => {
    const kind = errorKind(err);
    const status = (err as { response?: { status?: number } }).response?.status;
    if (kind === 'connection' || kind === 'server') {
      setError(`No pudimos confirmar si ${done} por la conexión. Estamos comprobando el estado de tu reserva; si no cambia, inténtalo de nuevo.`);
    } else {
      setError(apiErrorMessage(err));
    }
    if (kind === 'connection' || kind === 'server' || status === 409) void queryClient.invalidateQueries({ queryKey: ['public-manage', tenantSlug, token] });
  };
  const cancel = useMutation({
    mutationFn: async () => (await publicApi.post<ManageView>(`${base}/cancel`, {})).data,
    onSuccess: onDone,
    onError: (err) => onActionError(err, 'se canceló'),
  });
  const reschedule = useMutation({
    mutationFn: async (startTime: string) => (await publicApi.post<ManageView>(`${base}/reschedule`, { date: dateStr, startTime })).data,
    onSuccess: onDone,
    onError: (err) => onActionError(err, 'se cambió'),
  });

  // Si al comprobar resulta que la reserva ya no está activa, no se muestran los paneles de cancelar o cambiar.
  const isActive = view.data ? view.data.appointment.status === 'SCHEDULED' || view.data.appointment.status === 'PENDING' : false;
  const shownMode = isActive ? mode : 'view';

  if (view.isLoading) return <PublicShell title="Mi reserva"><LoadingPage retrying={view.failureCount > 0} /></PublicShell>;
  if (invalidLink || !view.data) {
    return (
      <PublicShell title="Mi reserva">
        {invalidLink || !failureKind ? (
          <p className="text-center text-muted-foreground py-12">Este enlace no es válido o ya venció. Si necesitas ayuda, contacta al negocio.</p>
        ) : (
          <ConnectionProblem kind={failureKind as 'connection' | 'server'} onRetry={() => void view.refetch()} retrying={view.isFetching} />
        )}
      </PublicShell>
    );
  }

  // Mostrando lo guardado porque no se pudo actualizar: no se deja cambiar nada hasta tener el estado real.
  const outdated = failureKind !== null;
  const { appointment: a, salonName, cancelWindowHrs, telegram } = view.data;
  const canCancel = view.data.canCancel;
  const canReschedule = view.data.canReschedule;
  const day = cap(format(new Date(`${a.date.split('T')[0]}T00:00:00`), "EEEE d 'de' MMMM", { locale: es }));
  const today = startOfDay(new Date());
  const active = a.status === 'SCHEDULED' || a.status === 'PENDING';

  return (
    <PublicShell title={salonName} salon={{ slug: tenantSlug, name: salonName, logoUrl: view.data.logoUrl, brandColor: view.data.brandColor }} subtitle="Tu reserva">
      <section className="bg-card rounded-2xl border border-border p-5 space-y-2">
        <span
          className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${
            a.status === 'CANCELLED' ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300' : active ? 'bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300' : 'bg-muted text-muted-foreground'
          }`}
        >
          {STATUS_LABEL[a.status]}
        </span>
        <div className="text-lg font-semibold text-foreground">{a.serviceName}</div>
        <div className="text-muted-foreground">{day} · {a.startTime}–{a.endTime}</div>
        {a.professionalName && <div className="text-muted-foreground">Con {a.professionalName}</div>}
        <div className="text-muted-foreground">{money(a.priceAmount, a.currency)}</div>
      </section>

      {outdated && (
        <StaleNotice onRetry={() => void view.refetch()} retrying={view.isFetching}>
          No pudimos actualizar tu reserva: ves la que guardamos el {format(new Date(view.dataUpdatedAt), "d 'de' MMM 'a las' HH:mm", { locale: es })}. Para cambiarla o cancelarla necesitas conexión.
        </StaleNotice>
      )}

      {active && <AddToCalendar event={{ title: `${a.serviceName} en ${salonName}`, startsAt: a.startsAt, endsAt: a.endsAt, location: salonName, details: a.professionalName ? `Con ${a.professionalName}` : undefined, uid: a.id }} />}
      {active && <TelegramOptIn telegram={telegram} />}

      {error && <div role="alert" className="rounded-xl bg-red-50 text-red-800 px-4 py-3 text-sm border border-red-200 dark:bg-red-950/50 dark:text-red-200 dark:border-red-900">{error}</div>}

      {active && !canCancel && !outdated && (
        <p className="text-sm text-muted-foreground bg-card rounded-xl border border-border p-4">
          Los cambios y cancelaciones se hacen hasta {cancelWindowHrs} horas antes. Para cualquier cambio ahora, contacta directamente al negocio.
        </p>
      )}

      {shownMode === 'view' && active && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            disabled={!canReschedule || outdated}
            onClick={() => { setMode('reschedule'); setError(''); }}
            className="py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cambiar fecha u hora
          </button>
          <button
            disabled={!canCancel || outdated}
            onClick={() => { setMode('confirmCancel'); setError(''); }}
            className="py-3 rounded-xl border border-red-300 text-red-700 font-semibold hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancelar reserva
          </button>
        </div>
      )}

      {shownMode === 'confirmCancel' && (
        <section className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <p className="text-foreground">¿Seguro que quieres cancelar esta reserva?</p>
          <div className="flex gap-3">
            <button onClick={() => setMode('view')} className="flex-1 py-3 rounded-xl border border-border text-foreground">No, mantenerla</button>
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

      {shownMode === 'reschedule' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Elige el nuevo día y hora</h2>
          <div className="bg-card rounded-2xl border border-border p-3 overflow-x-auto">
            <LazyCalendar
              mode="single"
              locale={es}
              selected={date}
              onSelect={setDate}
              disabled={(d) => isBefore(startOfDay(d), today) || d > addDays(today, 120)}
              className="w-full min-w-[17rem] bg-transparent text-foreground"
            />
          </div>
          {date && (
            slots.isLoading ? (
              <Spinner />
            ) : slots.isError ? (
              <div role="alert" className="space-y-3 text-center">
                <p className="text-muted-foreground">No pudimos cargar los horarios. Revisa tu conexión.</p>
                <button onClick={() => void slots.refetch()} className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">Reintentar</button>
              </div>
            ) : (slots.data ?? []).length === 0 ? (
              <p className="text-center text-muted-foreground">No hay horarios ese día.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.data!.map((s) => (
                  <button
                    key={s.startTime}
                    disabled={reschedule.isPending}
                    onClick={() => reschedule.mutate(s.startTime)}
                    className="py-3 rounded-xl border border-border bg-card font-medium text-foreground hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-50"
                  >
                    {s.startTime}
                  </button>
                ))}
              </div>
            )
          )}
          <button onClick={() => setMode('view')} className="w-full py-3 rounded-xl border border-border text-foreground">Volver</button>
        </section>
      )}
    </PublicShell>
  );
};

export default ManageBooking;
