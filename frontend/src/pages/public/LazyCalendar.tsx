import { lazy, Suspense, type ComponentProps, type ReactNode } from 'react';
import type { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { loadCalendar } from './calendarLoader';
import { Spinner } from './shared';

const Calendar = lazy(() => loadCalendar().then((m) => ({ default: m.Calendar })));

/** Calendario cargado bajo demanda: no pesa en la primera pantalla de la reserva. */
export default function LazyCalendar({ fallback, ...props }: ComponentProps<typeof CalendarComponent> & { fallback?: ReactNode }) {
  return (
    <Suspense fallback={fallback ?? <Spinner />}>
      <Calendar {...props} />
    </Suspense>
  );
}
