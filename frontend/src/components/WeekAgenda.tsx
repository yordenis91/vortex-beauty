import React, { useCallback, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar';
import withDragAndDropModule, { type EventInteractionArgs } from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, getDay, parse, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale/es';
import type { Appointment } from '../types';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './week-agenda.css';
import { useLabels } from '@/hooks/useLabels';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { es },
});

interface AgendaEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  appointment: Appointment;
}

// El addon es CommonJS: según el empaquetador, la función llega como `default` o como el módulo entero.
const withDragAndDrop = ((withDragAndDropModule as unknown as { default?: unknown }).default ??
  withDragAndDropModule) as typeof withDragAndDropModule;

const DnDCalendar = withDragAndDrop<AgendaEvent>(Calendar<AgendaEvent>);

const ACTIVE = new Set(['SCHEDULED', 'PENDING']);

/**
 * Hora de pared del salón como Date local: las citas traen `date` (día local) y
 * `startTime`/`endTime` (hora local del salón). El calendario solo muestra y
 * devuelve esas componentes, así que funciona igual aunque el navegador esté
 * en otra zona horaria.
 */
function wallClock(dateIso: string, time: string): Date {
  const [y, m, d] = dateIso.split('T')[0].split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  SCHEDULED: '#3b82f6',
  COMPLETED: '#10b981',
  CANCELLED: '#9ca3af',
  NO_SHOW: '#6b7280',
};

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

interface Props {
  appointments: Appointment[];
  date: Date;
  view: 'week' | 'day';
  /** Rango visible de la jornada, p. ej. { from: '08:00', to: '20:00' } */
  hours: { from: string; to: string };
  /** Cada cuántos minutos se ofrece un hueco (Ajustes del salón): el arrastre encaja en esa cuadrícula. */
  stepMinutes: number;
  onNavigate: (date: Date) => void;
  onViewChange: (view: 'week' | 'day') => void;
  onSelectAppointment: (appointment: Appointment) => void;
  onCreateAt: (dateStr: string, startTime: string) => void;
  /** Mover una cita a otro día u hora (misma duración y mismo profesional). */
  onMove: (appointment: Appointment, dateStr: string, startTime: string) => void;
}

const WeekAgenda: React.FC<Props> = ({ appointments, date, view, hours, stepMinutes, onNavigate, onViewChange, onSelectAppointment, onCreateAt, onMove }) => {
  const { label } = useLabels();
  const customerWord = label('customer', true);
  const events = useMemo<AgendaEvent[]>(
    () =>
      appointments
        .filter((a) => a.status !== 'CANCELLED')
        .map((a) => ({
          id: a.id,
          title: `${a.client?.name ?? customerWord} · ${a.serviceName}`,
          start: wallClock(a.date, a.startTime),
          end: wallClock(a.date, a.endTime),
          appointment: a,
        })),
    [appointments, customerWord]
  );

  const minTime = useMemo(() => new Date(1970, 0, 1, Math.floor(toMinutes(hours.from) / 60), toMinutes(hours.from) % 60), [hours.from]);
  const maxTime = useMemo(() => new Date(1970, 0, 1, Math.floor(toMinutes(hours.to) / 60), toMinutes(hours.to) % 60), [hours.to]);

  const handleMove = useCallback(
    ({ event, start }: EventInteractionArgs<AgendaEvent>) => {
      const s = start instanceof Date ? start : new Date(start);
      onMove(event.appointment, format(s, 'yyyy-MM-dd'), format(s, 'HH:mm'));
    },
    [onMove]
  );

  return (
    <div className="week-agenda h-[70vh] min-h-[480px] bg-card rounded-2xl border border-border p-2">
      <DnDCalendar
        localizer={localizer}
        culture="es"
        events={events}
        date={date}
        view={view as View}
        views={['week', 'day']}
        onView={(v) => onViewChange(v === 'day' ? 'day' : 'week')}
        onNavigate={onNavigate}
        min={minTime}
        max={maxTime}
        step={stepMinutes}
        timeslots={Math.max(1, Math.round(60 / stepMinutes))}
        scrollToTime={new Date(1970, 0, 1, 8)}
        selectable
        resizable={false}
        popup
        draggableAccessor={(e) => ACTIVE.has(e.appointment.status)}
        onEventDrop={handleMove}
        onSelectEvent={(e) => onSelectAppointment(e.appointment)}
        onSelectSlot={({ start }) => {
          const s = start instanceof Date ? start : new Date(start);
          onCreateAt(format(s, 'yyyy-MM-dd'), format(s, 'HH:mm'));
        }}
        eventPropGetter={(e) => {
          const a = e.appointment;
          const color = ACTIVE.has(a.status) ? a.professional?.color || STATUS_COLORS[a.status] : STATUS_COLORS[a.status];
          return {
            style: {
              backgroundColor: color,
              borderColor: color,
              opacity: ACTIVE.has(a.status) ? 1 : 0.65,
              textDecoration: a.status === 'NO_SHOW' ? 'line-through' : undefined,
            },
          };
        }}
        tooltipAccessor={(e) =>
          `${e.appointment.startTime}–${e.appointment.endTime} · ${e.appointment.serviceName}${e.appointment.professional ? ` · ${e.appointment.professional.name}` : ''}`
        }
        messages={{
          today: 'Hoy',
          previous: '‹',
          next: '›',
          week: 'Semana',
          day: 'Día',
          date: 'Fecha',
          time: 'Hora',
          event: label('appointment', true),
          allDay: 'Todo el día',
          noEventsInRange: `Sin ${label('appointments')} en este rango.`,
          showMore: (n) => `+${n} más`,
        }}
      />
    </div>
  );
};

export default WeekAgenda;
