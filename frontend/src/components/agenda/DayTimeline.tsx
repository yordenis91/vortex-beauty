import React, { useEffect, useRef } from 'react';
import { Lock, Plus } from 'lucide-react';
import type { Appointment, AppointmentStatus } from '../../types';
import { durationText, toHHmm, type TimelineItem } from '../../lib/agenda';

const STATUS: Record<AppointmentStatus, { label: string; chip: string; bar: string }> = {
  PENDING: { label: 'Pendiente', chip: 'bg-amber-50 text-amber-700 border-amber-200', bar: '#f59e0b' },
  SCHEDULED: { label: 'Agendada', chip: 'bg-blue-50 text-blue-700 border-blue-200', bar: '#3b82f6' },
  COMPLETED: { label: 'Completada', chip: 'bg-green-50 text-green-700 border-green-200', bar: '#10b981' },
  CANCELLED: { label: 'Cancelada', chip: 'bg-red-50 text-red-700 border-red-200', bar: '#ef4444' },
  NO_SHOW: { label: 'No asistió', chip: 'bg-muted text-muted-foreground border-border', bar: '#6b7280' },
};

interface Props {
  items: TimelineItem[];
  showProfessional: boolean;
  onOpen: (appointment: Appointment) => void;
  onGap: (time: string, professionalId: string) => void;
  emptyText: string;
}

const Row: React.FC<{ time: string; children: React.ReactNode }> = ({ time, children }) => (
  <div className="flex gap-3">
    <div className="w-12 shrink-0 pt-3 text-right text-sm font-medium tabular-nums text-muted-foreground">{time}</div>
    <div className="min-w-0 flex-1">{children}</div>
  </div>
);

const DayTimeline: React.FC<Props> = ({ items, showProfessional, onOpen, onGap, emptyText }) => {
  const anchor = useRef<HTMLDivElement>(null);

  // Al abrir un día, la lista se coloca en lo que viene ahora (o en lo primero del día).
  const anchorKey = items.find((i) => i.kind === 'now')?.key ?? items.find((i) => i.kind === 'appointment')?.key ?? '';
  useEffect(() => {
    anchor.current?.scrollIntoView?.({ block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey, items.length === 0]);

  if (!items.some((i) => i.kind !== 'now')) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 px-6 py-10 text-center text-muted-foreground">
        <p className="text-base font-medium text-foreground">{emptyText}</p>
        <p className="text-sm">Toca el botón + para crear una cita.</p>
      </div>
    );
  }

  let anchored = false;
  return (
    <ul className="space-y-2 pb-24">
      {items.map((item) => {
        const isAnchor = !anchored && ((item.kind === 'now') || (anchorKey === '' ? false : item.key === anchorKey));
        if (isAnchor) anchored = true;
        const ref = isAnchor ? anchor : undefined;

        if (item.kind === 'now') {
          return (
            <li key={item.key} ref={ref as React.Ref<HTMLLIElement>} aria-label={`Ahora, ${toHHmm(item.start)}`} className="flex items-center gap-3 scroll-mt-2">
              <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-red-600">{toHHmm(item.start)}</span>
              <span className="flex min-w-0 flex-1 items-center">
                <i className="block h-2.5 w-2.5 shrink-0 rounded-full bg-red-600" />
                <i className="block h-0.5 flex-1 bg-red-600" />
              </span>
            </li>
          );
        }

        if (item.kind === 'gap') {
          const time = toHHmm(item.start);
          return (
            <li key={item.key}>
              <Row time={time}>
                <button
                  type="button"
                  onClick={() => onGap(time, item.professionalId)}
                  className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/60"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    {item.cupo ? (
                      <>Cupo libre · <span className="font-medium text-foreground">{time}</span></>
                    ) : (
                      <>Libre {time}–{toHHmm(item.end)} · <span className="font-medium text-foreground">{durationText(item.end - item.start)}</span></>
                    )}
                  </span>
                </button>
              </Row>
            </li>
          );
        }

        if (item.kind === 'block') {
          return (
            <li key={item.key}>
              <Row time={toHHmm(item.start)}>
                <div className="flex min-h-12 items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">
                    Bloqueado{item.reason ? ` · ${item.reason}` : ''} · {toHHmm(item.start)}–{toHHmm(item.end)}
                  </span>
                </div>
              </Row>
            </li>
          );
        }

        const a = item.appointment;
        const status = STATUS[a.status];
        const quiet = a.status === 'CANCELLED' || a.status === 'NO_SHOW';
        const color = a.professional?.color && showProfessional ? a.professional.color : status.bar;
        return (
          <li key={item.key} ref={ref as React.Ref<HTMLLIElement>} className="scroll-mt-2">
            <Row time={a.startTime}>
              <button
                type="button"
                onClick={() => onOpen(a)}
                className={`flex w-full gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-sm active:bg-muted ${quiet ? 'opacity-60' : ''}`}
              >
                <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-base font-semibold text-foreground ${quiet ? 'line-through' : ''}`}>{a.client?.name ?? 'Cliente'}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {a.serviceName} · {a.startTime}–{a.endTime}
                  </span>
                  {showProfessional && a.professional && <span className="block truncate text-sm text-muted-foreground">{a.professional.name}</span>}
                </span>
                {a.status !== 'SCHEDULED' && (
                  <span className={`h-fit shrink-0 rounded-full border px-2 py-0.5 text-xs ${status.chip}`}>{status.label}</span>
                )}
              </button>
            </Row>
          </li>
        );
      })}
    </ul>
  );
};

export default DayTimeline;
