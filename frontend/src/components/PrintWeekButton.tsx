import React, { useState } from 'react';
import { Printer } from 'lucide-react';
import { printWeek } from '../lib/printWeek';

/** Botón del encabezado de la agenda: imprime la semana del día que se está viendo. */
const PrintWeekButton: React.FC<{ date: Date }> = ({ date }) => {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await printWeek(date);
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
    >
      <Printer aria-hidden="true" className="mr-2 h-4 w-4" />
      {busy ? 'Preparando…' : 'Imprimir mi semana'}
    </button>
  );
};

export default PrintWeekButton;
