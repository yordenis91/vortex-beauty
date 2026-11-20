import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNowStrict, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { Bell, CalendarClock, CalendarPlus, CalendarX, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useActivityFeed, useMarkActivitySeen, type ActivityItem } from '../hooks/useActivity';
import { useBookingSettings } from '../hooks/useQueries';
import { localParts } from '../lib/agenda';

const SOUND_KEY = 'afilao:bell-sound';

function readSound(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === '1';
  } catch {
    return false;
  }
}

function saveSound(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? '1' : '0');
  } catch {
    /* sin almacenamiento: el interruptor vale solo para esta sesión */
  }
}

/** «mar 18 nov · 10:00», en la zona horaria del salón. */
function when(timezone: string, iso: string): string {
  const { date, time } = localParts(timezone, new Date(iso));
  return `${format(parseISO(`${date}T12:00:00`), "EEE d MMM", { locale: es })} · ${time}`;
}

function describe(event: ActivityItem): { title: string; icon: React.ReactNode; tone: string } {
  const byCustomer = event.actor === 'CUSTOMER';
  const paper = event.source === 'PAPEL' ? ' (del papel)' : '';
  switch (event.kind) {
    case 'CREATED':
      return {
        title: byCustomer ? `${event.clientName} reservó` : `Se agendó a ${event.clientName}${paper}`,
        icon: <CalendarPlus className="h-4 w-4" aria-hidden />,
        tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      };
    case 'RESCHEDULED':
      return {
        title: byCustomer ? `${event.clientName} cambió su cita` : `Se cambió la cita de ${event.clientName}`,
        icon: <CalendarClock className="h-4 w-4" aria-hidden />,
        tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      };
    default:
      return {
        title: byCustomer ? `${event.clientName} canceló su cita` : `Se canceló la cita de ${event.clientName}`,
        icon: <CalendarX className="h-4 w-4" aria-hidden />,
        tone: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
      };
  }
}

/**
 * Campanita del panel: solo novedades de reservas (nueva, cambio, cancelación).
 * Abrir el panel las muestra; al cerrarlo quedan como vistas.
 */
const ActivityBell: React.FC = () => {
  const navigate = useNavigate();
  const { data: settings } = useBookingSettings();
  const timezone = settings?.timezone ?? 'America/Havana';
  const feed = useActivityFeed();
  const markSeen = useMarkActivitySeen();
  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState(readSound);

  const pages = useMemo(() => feed.data?.pages ?? [], [feed.data]);
  const items = useMemo(() => pages.flatMap((p) => p.items), [pages]);
  const unread = pages[0]?.unread ?? 0;

  // Sonido solo cuando llegan novedades mientras la app está abierta (nunca en la primera carga).
  const previous = useRef<number | null>(null);
  useEffect(() => {
    if (!feed.isSuccess) return;
    if (previous.current !== null && unread > previous.current && sound) {
      try {
        void new Audio('/notification.mp3').play().catch(() => undefined);
      } catch {
        /* sin audio disponible */
      }
    }
    previous.current = unread;
  }, [unread, feed.isSuccess, sound]);

  // «(2) Afilao» en la pestaña, para verlo aunque esté en segundo plano.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\) /, '');
    document.title = unread > 0 ? `(${unread > 99 ? '99+' : unread}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [unread]);

  const finish = () => {
    if (unread > 0) markSeen.mutate(pages[0]?.items[0]?.createdAt);
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) finish();
  };

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    saveSound(next);
  };

  const goTo = (event: ActivityItem) => {
    setOpen(false);
    finish();
    const { date } = localParts(timezone, new Date(event.startsAt));
    const params = new URLSearchParams({ fecha: date });
    if (event.kind !== 'CANCELLED' && event.appointmentId) params.set('cita', event.appointmentId);
    navigate(`/admin/appointments?${params.toString()}`);
  };

  const today = items.filter((e) => isToday(parseISO(e.createdAt)));
  const before = items.filter((e) => !isToday(parseISO(e.createdAt)));
  const badge = unread > 99 ? '99+' : String(unread);

  const row = (event: ActivityItem) => {
    const view = describe(event);
    return (
      <li key={event.id}>
        <button
          type="button"
          onClick={() => goTo(event)}
          className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${view.tone}`}>{view.icon}</span>
          <span className="min-w-0 flex-1">
            <span className={`block text-sm ${event.unread ? 'font-semibold' : 'font-medium'} text-foreground`}>{view.title}</span>
            <span className="block text-xs text-foreground/80">{when(timezone, event.startsAt)}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {event.serviceName}
              {event.professionalName ? ` · ${event.professionalName}` : ''}
            </span>
            {event.kind === 'RESCHEDULED' && event.previousStartsAt && (
              <span className="block text-xs text-muted-foreground">Antes: {when(timezone, event.previousStartsAt)}</span>
            )}
            <span className="block text-xs text-muted-foreground">hace {formatDistanceToNowStrict(parseISO(event.createdAt), { locale: es })}</span>
          </span>
          {event.unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Sin ver" />}
        </button>
      </li>
    );
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="relative" aria-label={unread > 0 ? `Novedades de reservas, ${unread} sin ver` : 'Novedades de reservas'}>
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-background">
              {badge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] gap-0 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold text-foreground">Novedades</h2>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Silenciar el sonido de avisos' : 'Activar el sonido de avisos'}>
              {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={unread === 0} onClick={() => markSeen.mutate(pages[0]?.items[0]?.createdAt)}>
              Marcar todo como visto
            </Button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-1">
          {feed.isLoading && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Cargando…</p>}
          {feed.isError && !feed.data && <p role="alert" className="px-3 py-6 text-center text-sm text-muted-foreground">No se pudieron cargar las novedades. Se reintentará sola.</p>}
          {feed.isSuccess && items.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Aún no hay novedades. Aquí verás cuando alguien reserve, cambie o cancele una cita.</p>
          )}
          {today.length > 0 && (
            <section aria-label="Hoy">
              <h3 className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hoy</h3>
              <ul>{today.map(row)}</ul>
            </section>
          )}
          {before.length > 0 && (
            <section aria-label="Antes">
              <h3 className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Antes</h3>
              <ul>{before.map(row)}</ul>
            </section>
          )}
          {feed.hasNextPage && (
            <div className="p-2">
              <Button type="button" variant="outline" size="sm" className="w-full" disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>
                {feed.isFetchingNextPage ? 'Cargando…' : 'Ver más'}
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ActivityBell;
