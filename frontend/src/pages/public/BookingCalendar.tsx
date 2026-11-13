import React, { useRef, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfWeek,
  format,
  getDay,
  getDaysInMonth,
  getWeeksInMonth,
  isBefore,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale/es';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import LazyCalendar from './LazyCalendar';

/** Desplazamiento horizontal mínimo (px) para que un gesto cuente como «deslizar», y cuánto debe dominar al vertical. */
const SWIPE_MIN_PX = 50;
const SWIPE_DOMINANCE = 1.5;

const WEEKDAYS = eachDayOfInterval({ start: startOfWeek(new Date(), { locale: es }), end: endOfWeek(new Date(), { locale: es }) }).map((d) =>
  format(d, 'EEEEEE', { locale: es }),
);

/** Días con huecos: se ven como fichas tocables (azul suave); el resto queda atenuado. */
const availableDayClass =
  '[&_button]:bg-blue-50 [&_button]:font-semibold [&_button]:text-blue-700 [&_button:hover]:bg-blue-100 ' +
  'dark:[&_button]:bg-blue-900/40 dark:[&_button]:text-blue-200 dark:[&_button:hover]:bg-blue-900/60';

/** El día de hoy lleva un puntito bajo el número en vez de un fondo propio, que se confundiría con «disponible». */
const todayClass =
  '[&_button]:after:absolute [&_button]:after:bottom-1.5 [&_button]:after:left-1/2 [&_button]:after:h-1 [&_button]:after:w-1 ' +
  '[&_button]:after:-translate-x-1/2 [&_button]:after:rounded-full [&_button]:after:bg-current';

/** Mismas medidas que el calendario real (cabecera de días + filas de celdas cuadradas): al llegar los datos no se mueve nada. */
export function CalendarSkeleton({ month }: { month: Date }) {
  const offset = (getDay(startOfMonth(month)) + 6) % 7; // la semana empieza en lunes
  const days = getDaysInMonth(month);
  const weeks = getWeeksInMonth(month, { weekStartsOn: 1 });
  return (
    <div role="status" aria-label="Cargando días disponibles" className="w-full">
      <div aria-hidden="true" className="grid grid-cols-7 text-center text-[0.8rem] text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      {Array.from({ length: weeks }, (_, week) => (
        <div key={week} aria-hidden="true" className="mt-2 grid grid-cols-7">
          {Array.from({ length: 7 }, (_, day) => {
            const index = week * 7 + day;
            const visible = index >= offset && index < offset + days;
            return (
              <div key={day} className="aspect-square p-[3px]">
                {visible && (
                  <div
                    className="h-full w-full animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
                    style={{ animationDelay: `${(week + day) * 70}ms` }}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const NavButton: React.FC<{ label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }> = ({ label, disabled, onClick, children }) => (
  <button
    type="button"
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className="flex h-11 w-11 items-center justify-center rounded-full text-foreground transition hover:bg-muted active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-30"
  >
    {children}
  </button>
);

interface BookingCalendarProps {
  month: Date;
  onMonthChange: (month: Date) => void;
  selected?: Date;
  onSelect: (date: Date) => void;
  today: Date;
  maxDate: Date;
  /** Fechas (yyyy-MM-dd) con huecos en el mes visible; `undefined` mientras se cargan. */
  availableDates?: Set<string>;
  error?: boolean;
  onRetry?: () => void;
}

/** Calendario de la reserva: no muestra ningún día hasta saber cuáles tienen huecos, y se maneja con flechas o deslizando. */
const BookingCalendar: React.FC<BookingCalendarProps> = ({ month, onMonthChange, selected, onSelect, today, maxDate, availableDates, error, onRetry }) => {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [direction, setDirection] = useState<1 | -1 | 0>(0);

  const canPrev = startOfMonth(month) > startOfMonth(today);
  const canNext = startOfMonth(addMonths(month, 1)) <= maxDate;
  const loading = !availableDates && !error;

  const go = (delta: 1 | -1) => {
    if (delta < 0 ? !canPrev : !canNext) return;
    setDirection(delta);
    onMonthChange(addMonths(month, delta));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * SWIPE_DOMINANCE) return;
    go(dx < 0 ? 1 : -1); // hacia la izquierda: mes siguiente
  };

  const slide =
    direction === 0
      ? ''
      : `animate-in fade-in duration-200 motion-reduce:animate-none ${direction > 0 ? 'slide-in-from-right-4' : 'slide-in-from-left-4'}`;
  const monthLabel = format(month, 'LLLL yyyy', { locale: es });

  return (
    <>
      <div
        role="group"
        aria-label="Calendario de días disponibles"
        className="touch-pan-y select-none rounded-2xl border border-border bg-card p-3 shadow-sm"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => { touchStart.current = null; }}
      >
        <div className="mb-2 flex items-center justify-between">
          <NavButton label="Mes anterior" disabled={!canPrev} onClick={() => go(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </NavButton>
          <p aria-live="polite" className="font-semibold capitalize text-foreground">{monthLabel}</p>
          <NavButton label="Mes siguiente" disabled={!canNext} onClick={() => go(1)}>
            <ChevronRight className="h-5 w-5" />
          </NavButton>
        </div>

        <div key={format(month, 'yyyy-MM')} className={slide}>
          {error ? (
            <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
              No pudimos cargar los días disponibles.
              {onRetry && (
                <button type="button" onClick={onRetry} className="rounded-xl border border-border bg-card px-4 py-2 font-medium text-foreground shadow-sm hover:bg-muted">
                  Reintentar
                </button>
              )}
            </div>
          ) : loading ? (
            <CalendarSkeleton month={month} />
          ) : (
            <LazyCalendar
              mode="single"
              locale={es}
              month={month}
              hideNavigation
              showOutsideDays={false}
              onMonthChange={(m) => go(m > month ? 1 : -1)}
              selected={selected}
              onSelect={(d) => { if (d) onSelect(d); }}
              disabled={(d) => isBefore(startOfDay(d), today) || d > maxDate || !availableDates!.has(format(d, 'yyyy-MM-dd'))}
              modifiers={{ available: (d) => !!availableDates?.has(format(d, 'yyyy-MM-dd')) }}
              modifiersClassNames={{ available: availableDayClass }}
              classNames={{
                month_caption: 'hidden', // la cabecera del mes es propia (flechas de 44 px + deslizar)
                month: 'flex w-full flex-col',
                // Sin text-center las iniciales quedaban pegadas a la izquierda de su columna y no coincidían con los números.
                weekday: 'flex-1 text-center text-[0.8rem] font-normal text-muted-foreground select-none',
                // 3 px de aire alrededor de cada día para que las fichas resaltadas no se toquen entre sí.
                day: 'group/day relative aspect-square h-full w-full min-w-0 p-[3px] text-center select-none',
                today: todayClass,
              }}
              className="w-full bg-transparent p-0"
              fallback={<CalendarSkeleton month={month} />}
            />
          )}
        </div>
      </div>

      {availableDates && availableDates.size === 0 && !error && (
        <div className="rounded-2xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
          No hay días disponibles en {monthLabel}.
          {canNext && (
            <>
              {' '}
              <button type="button" onClick={() => go(1)} className="font-medium text-blue-600 underline underline-offset-2">
                Ver {format(addMonths(month, 1), 'MMMM', { locale: es })}
              </button>
            </>
          )}
        </div>
      )}

      {availableDates && availableDates.size > 0 && (
        <div className="space-y-1 text-center text-xs text-muted-foreground">
          <p className="flex items-center justify-center gap-4">
            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded bg-blue-100 ring-1 ring-blue-200" /> Con horarios</span>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded bg-muted ring-1 ring-border" /> Sin horarios</span>
          </p>
          <p className="hidden pointer-coarse:block">Desliza hacia los lados para cambiar de mes</p>
        </div>
      )}
    </>
  );
};

export default BookingCalendar;
