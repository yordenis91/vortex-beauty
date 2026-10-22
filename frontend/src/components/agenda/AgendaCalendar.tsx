import React, { useRef } from 'react';
import { addDays, addMonths, format } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthGrid, weekOf, ymd, type DayMark } from '../../lib/agenda';

export type CalendarMode = 'month' | 'week';

interface Props {
  selected: Date;
  onSelect: (day: Date) => void;
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  marks: Map<string, DayMark>;
  /** Días en que el negocio no atiende (cerrado o feriado). */
  isClosed: (day: Date) => boolean;
  today: string;
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Calendario compacto de la agenda del móvil: el mes entero o una sola semana, con puntos en los
 * días que tienen citas. El asa de abajo lo cambia de uno a otro; deslizar de lado cambia de mes o semana.
 */
const AgendaCalendar: React.FC<Props> = ({ selected, onSelect, mode, onModeChange, marks, isClosed, today }) => {
  const days = mode === 'month' ? monthGrid(selected) : weekOf(selected);
  const selectedKey = ymd(selected);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const move = (direction: 1 | -1) => onSelect(mode === 'month' ? addMonths(selected, direction) : addDays(selected, 7 * direction));

  const onPointerDown = (e: React.PointerEvent) => {
    touch.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!touch.current) return;
    const dx = e.clientX - touch.current.x;
    const dy = e.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
  };

  // Asa: arrastrar hacia abajo muestra el mes; hacia arriba, solo la semana. Un toque la alterna.
  const handle = useRef<number | null>(null);
  const onHandleDown = (e: React.PointerEvent) => {
    handle.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onHandleUp = (e: React.PointerEvent) => {
    if (handle.current == null) return;
    const dy = e.clientY - handle.current;
    handle.current = null;
    if (dy > 24) onModeChange('month');
    else if (dy < -24) onModeChange('week');
    else onModeChange(mode === 'month' ? 'week' : 'month');
  };

  return (
    <div className="select-none rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-1 px-2 pt-2">
        <button type="button" aria-label={mode === 'month' ? 'Mes anterior' : 'Semana anterior'} onClick={() => move(-1)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button type="button" aria-label={mode === 'month' ? 'Mes siguiente' : 'Semana siguiente'} onClick={() => move(1)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted">
          <ChevronRight className="h-5 w-5" />
        </button>
        <h3 className="flex-1 truncate px-1 text-lg font-semibold text-foreground" aria-live="polite">
          {cap(format(selected, 'MMMM yyyy', { locale: es }))}
        </h3>
        <button type="button" onClick={() => onSelect(new Date(`${today}T00:00:00`))} className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted">
          Hoy
        </button>
      </div>

      <div style={{ touchAction: 'pan-y' }} onPointerDown={onPointerDown} onPointerUp={onPointerUp} className="px-2 pb-1 pt-2">
        <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground" aria-hidden="true">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5" role="grid" aria-label="Calendario de citas">
          {days.map((day) => {
            const key = ymd(day);
            const mark = marks.get(key);
            const isSelected = key === selectedKey;
            const isToday = key === today;
            const outside = mode === 'month' && day.getMonth() !== selected.getMonth();
            const closed = isClosed(day);
            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                aria-selected={isSelected}
                aria-label={`${format(day, "EEEE d 'de' MMMM", { locale: es })}${mark ? `, ${mark.count} ${mark.count === 1 ? 'cita' : 'citas'}` : ''}${closed ? ', cerrado' : ''}`}
                onClick={() => onSelect(day)}
                className="flex h-11 flex-col items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-offset-1"
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                    isSelected ? 'bg-blue-600 font-semibold text-white' : isToday ? 'font-semibold text-blue-700 ring-2 ring-blue-500' : closed || outside ? 'text-muted-foreground/60' : 'text-foreground'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                <span className="mt-0.5 flex h-1.5 items-center gap-0.5" aria-hidden="true">
                  {mark?.colors.map((c) => (
                    <i key={c} className="block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        aria-label={mode === 'month' ? 'Mostrar solo la semana' : 'Mostrar el mes completo'}
        onPointerDown={onHandleDown}
        onPointerUp={onHandleUp}
        // Con teclado (Enter o espacio) no hay eventos de puntero: el clic sin posición alterna el modo.
        onClick={(e) => {
          if (e.detail === 0) onModeChange(mode === 'month' ? 'week' : 'month');
        }}
        style={{ touchAction: 'none' }}
        className="flex w-full items-center justify-center py-2"
      >
        <span className="h-1.5 w-10 rounded-full bg-muted-foreground/40" />
      </button>
    </div>
  );
};

export default AgendaCalendar;
