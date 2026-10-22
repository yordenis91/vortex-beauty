import React, { useEffect, useMemo, useState } from 'react';
import { addWeeks, format } from 'date-fns';
import toast from 'react-hot-toast';
import { es } from 'date-fns/locale/es';
import { CalendarCog, Copy, Lock, MoreVertical, Plus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTimeOff } from '../../hooks/useQueries';
import type { Appointment, AppointmentStatus, Professional } from '../../types';
import { blockOnDay, buildTimeline, localParts, marksByDate, parseYmd, toHHmm, toMin, ymd } from '../../lib/agenda';
import AgendaCalendar, { type CalendarMode } from './AgendaCalendar';
import DayTimeline from './DayTimeline';
import AppointmentSheet from './AppointmentSheet';
import QuickCreateSheet, { type CreatePreset } from './QuickCreateSheet';
import BlockHoursSheet from './BlockHoursSheet';

interface BusinessHourLite {
  dayOfWeek: number;
  isOpen: boolean;
  startTime: string;
  endTime: string;
}

interface Props {
  appointments: Appointment[];
  professionals: Professional[];
  businessHours: BusinessHourLite[];
  closedDates: Array<{ date: string }>;
  timezone: string;
  salonName?: string;
  selected: Date;
  onSelectedChange: (day: Date) => void;
  onEdit: (appointment: Appointment) => void;
  onStatus: (appointment: Appointment, status: AppointmentStatus) => void;
  onManageDay: (date: string) => void;
  canManage: boolean;
  /** Cita que se abre al llegar desde el buscador. */
  focusAppointmentId?: string | null;
  onFocusHandled?: () => void;
  /** Etiquetas del vocabulario del salón. */
  words: { appointments: string; appointment: string };
}

const MODE_KEY = 'afilao-agenda-modo';
const readMode = (): CalendarMode => {
  try {
    return localStorage.getItem(MODE_KEY) === 'week' ? 'week' : 'month';
  } catch {
    return 'month';
  }
};

/**
 * Agenda del móvil en dos mitades: arriba el calendario (mes o semana) con puntos en los días con citas;
 * abajo, las citas del día elegido con la línea de «ahora» y los huecos libres.
 */
const MobileAgenda: React.FC<Props> = ({ appointments, professionals, businessHours, closedDates, timezone, salonName, selected, onSelectedChange, onEdit, onStatus, onManageDay, canManage, focusAppointmentId, onFocusHandled, words }) => {
  const [mode, setModeState] = useState<CalendarMode>(readMode);
  const [professionalId, setProfessionalId] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [create, setCreate] = useState<CreatePreset | null>(null);
  const [blockDay, setBlockDay] = useState<string | null>(null);
  const open = useMemo(() => appointments.find((a) => a.id === openId) ?? null, [appointments, openId]);
  const [tick, setTick] = useState(0);

  const setMode = (next: CalendarMode) => {
    setModeState(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // sin almacenamiento: la elección vale solo para esta visita
    }
  };

  // Al llegar desde el buscador se abre la hoja de esa cita (en cuanto está cargada) hasta que se cierre.
  const focusedAppointment = focusAppointmentId ? appointments.find((a) => a.id === focusAppointmentId) ?? null : null;

  // La línea de «ahora» se mueve cada minuto.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const now = useMemo(() => localParts(timezone), [timezone, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const selectedKey = ymd(selected);
  const dayOfWeek = selected.getDay();
  const businessHour = businessHours.find((b) => b.dayOfWeek === dayOfWeek) ?? null;
  const closedSet = useMemo(() => new Set(closedDates.map((c) => c.date)), [closedDates]);
  const isClosed = (day: Date) => {
    const bh = businessHours.find((b) => b.dayOfWeek === day.getDay());
    return closedSet.has(ymd(day)) || (!!bh && !bh.isOpen);
  };

  const visible = useMemo(
    () => appointments.filter((a) => !professionalId || a.professionalId === professionalId),
    [appointments, professionalId]
  );
  const marks = useMemo(() => marksByDate(visible, professionals.length > 1), [visible, professionals.length]);
  const dayAppointments = useMemo(() => visible.filter((a) => a.date.split('T')[0] === selectedKey), [visible, selectedKey]);

  // Los huecos libres se muestran por profesional: el elegido, o el único que hay.
  const gapsFor = professionalId ? professionals.find((p) => p.id === professionalId) ?? null : professionals.length === 1 ? professionals[0] : null;
  const { data: timeOffs = [] } = useTimeOff(gapsFor?.id);
  const blocks = useMemo(
    () =>
      timeOffs
        .map((t) => ({ id: t.id, reason: t.reason, busy: blockOnDay(timezone, selectedKey, t) }))
        .filter((t): t is { id: string; reason: string | null | undefined; busy: { start: number; end: number } } => !!t.busy),
    [timeOffs, timezone, selectedKey]
  );

  const items = useMemo(
    () =>
      buildTimeline({
        appointments: dayAppointments,
        gapsFor,
        dayOfWeek,
        businessHour,
        closed: closedSet.has(selectedKey),
        timeOffs: blocks,
        nowMin: selectedKey === now.date ? toMin(now.time) : null,
      }),
    [dayAppointments, gapsFor, dayOfWeek, businessHour, closedSet, selectedKey, blocks, now]
  );

  // Texto listo para pegar en WhatsApp con las horas que quedan libres ese día.
  const copyFreeTimes = async () => {
    const times = items.filter((i) => i.kind === 'gap').map((i) => toHHmm(i.start));
    const day = format(selected, "EEEE d 'de' MMMM", { locale: es });
    if (times.length === 0) {
      toast(`No quedan horas libres el ${day}.`);
      return;
    }
    const text = `${salonName ? `${salonName}: ` : ''}horas libres el ${day}: ${times.join(', ')}. ¿Cuál te viene bien?`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Horas libres copiadas');
    } catch {
      toast(text, { duration: 8000 });
    }
  };

  const count = dayAppointments.filter((a) => a.status === 'SCHEDULED' || a.status === 'PENDING' || a.status === 'COMPLETED').length;
  const dayClosed = closedSet.has(selectedKey) || (!!businessHour && !businessHour.isOpen);

  return (
    <div className="relative -mx-1 flex h-[calc(100dvh-5.5rem)] flex-col gap-3">
      <AgendaCalendar selected={selected} onSelect={onSelectedChange} mode={mode} onModeChange={setMode} marks={marks} isClosed={isClosed} today={now.date} />

      <div className="flex items-center gap-2 px-1">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-foreground">
            {format(selected, 'EEEE d MMM', { locale: es }).replace(/^./, (c) => c.toUpperCase())}
          </h2>
          <p className="text-sm text-muted-foreground">
            {dayClosed ? 'Cerrado' : count === 0 ? `Sin ${words.appointments}` : `${count} ${count === 1 ? words.appointment : words.appointments}`}
          </p>
        </div>
        {professionals.length > 1 && (
          <select
            aria-label="Filtrar por profesional"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            className="max-w-[9.5rem] rounded-full border border-border bg-card px-3 py-1.5 text-sm"
          >
            <option value="">Todo el equipo</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Más opciones del día" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setBlockDay(selectedKey)}>
                <Lock className="h-4 w-4" /> Bloquear horas
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={copyFreeTimes}>
                <Copy className="h-4 w-4" /> Copiar horas libres
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onManageDay(selectedKey)}>
                <CalendarCog className="h-4 w-4" /> Gestionar horario de este día
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1" data-testid="lista-del-dia">
        <DayTimeline
          items={items}
          showProfessional={professionals.length > 1 && !professionalId}
          onOpen={(a) => setOpenId(a.id)}
          onGap={(time, pid) => setCreate({ date: selectedKey, time, professionalId: pid })}
          emptyText={dayClosed ? 'Tu negocio está cerrado este día' : `No hay ${words.appointments} este día`}
        />
      </div>

      <button
        type="button"
        aria-label={`Nueva ${words.appointment}`}
        onClick={() => setCreate({ date: selectedKey, professionalId: professionalId || undefined })}
        className="fixed bottom-5 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg active:scale-95"
        style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <Plus className="h-7 w-7" />
      </button>

      <AppointmentSheet
        appointment={open ?? focusedAppointment}
        salonName={salonName}
        onClose={() => {
          setOpenId(null);
          onFocusHandled?.();
        }}
        onStatus={onStatus}
        onEdit={onEdit}
        onNext={(a, weeks) => setCreate({ date: ymd(addWeeks(parseYmd(a.date.split('T')[0]), weeks)), time: a.startTime, clientId: a.clientId, serviceId: a.serviceId, professionalId: a.professionalId ?? undefined })}
      />
      <QuickCreateSheet preset={create} professionals={professionals} words={words} onClose={() => setCreate(null)} />
      <BlockHoursSheet date={blockDay} professionals={professionals} professionalId={professionalId || undefined} timezone={timezone} onClose={() => setBlockDay(null)} />
    </div>
  );
};

export default MobileAgenda;
