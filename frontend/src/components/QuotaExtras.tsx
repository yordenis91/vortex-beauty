import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';
import { useAddQuotaExtra, useQuotaExtras, useRemoveQuotaExtra } from '../hooks/useQueries';
import type { Professional } from '../types';

interface Props {
  professional: Professional;
  /** YYYY-MM-DD */
  date: string;
}

/**
 * Cupos de una profesional que reserva por cupos en un día: los habituales (de su ficha, solo
 * lectura) y los extra de esa fecha, que se agregan y se quitan aquí sin tocar los semanales.
 */
const QuotaExtras: React.FC<Props> = ({ professional, date }) => {
  const [time, setTime] = useState('');
  const { data: extras = [], isLoading } = useQuotaExtras(professional.id, date);
  const add = useAddQuotaExtra();
  const remove = useRemoveQuotaExtra();

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  const usual = (professional.quotaSlots ?? []).filter((q) => q.dayOfWeek === dayOfWeek).map((q) => q.time).sort();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{2}:\d{2}$/.test(time)) {
      toast.error('Elige la hora del cupo extra.');
      return;
    }
    add.mutate({ professionalId: professional.id, date, time }, { onSuccess: () => { setTime(''); toast.success('Cupo extra agregado'); } });
  };

  return (
    <section aria-label={`Cupos de ${professional.name}`} className="rounded-xl border border-border p-4">
      <h5 className="text-sm font-semibold text-foreground">{professional.name}</h5>

      <p className="mt-3 text-xs font-medium text-muted-foreground">Cupos de siempre este día</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {usual.length === 0 ? (
          <span className="text-xs text-muted-foreground">Ninguno</span>
        ) : (
          usual.map((t) => <span key={t} className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">{t}</span>)
        )}
      </div>

      <p className="mt-3 text-xs font-medium text-muted-foreground">Cupos extra solo para este día</p>
      <div className="mt-1 flex flex-wrap gap-2" aria-busy={isLoading}>
        {extras.length === 0 && !isLoading && <span className="text-xs text-muted-foreground">Ninguno</span>}
        {extras.map((x) => (
          <span key={x.id} className="inline-flex items-center gap-1 rounded-full bg-blue-100 py-1 pl-2.5 pr-1 text-xs text-blue-800 dark:bg-blue-950 dark:text-blue-200">
            {x.time}
            <button
              type="button"
              aria-label={`Quitar el cupo extra de las ${x.time} de ${professional.name}`}
              disabled={remove.isPending}
              onClick={() => remove.mutate({ professionalId: professional.id, id: x.id }, { onSuccess: () => toast.success('Cupo extra quitado') })}
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-blue-200 dark:hover:bg-blue-900"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>

      <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-label={`Hora del cupo extra de ${professional.name}`}
          className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-base text-foreground sm:flex-none"
        />
        <button
          type="submit"
          disabled={add.isPending}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Agregar cupo extra
        </button>
      </form>
    </section>
  );
};

export default QuotaExtras;
