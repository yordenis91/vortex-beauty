import React, { useState } from 'react';
import { ChevronDown, Printer } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { monthRange, printRange, printWeek } from '../lib/printWeek';
import PrintRangeDialog from './PrintRangeDialog';

const base = 'inline-flex items-center justify-center border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60';

/**
 * Impresión de la agenda en el encabezado: el botón imprime la semana del día que se está viendo y el menú de al lado
 * ofrece el mes, el mes que viene u otras fechas.
 */
const PrintWeekButton: React.FC<{ date: Date }> = ({ date }) => {
  const [busy, setBusy] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);

  const run = async (job: () => Promise<boolean>) => {
    setBusy(true);
    try {
      await job();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="inline-flex">
        <button type="button" disabled={busy} onClick={() => void run(() => printWeek(date))} className={`${base} rounded-l-md px-4`}>
          <Printer aria-hidden="true" className="mr-2 h-4 w-4" />
          {busy ? 'Preparando…' : 'Imprimir mi semana'}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" disabled={busy} aria-label="Más formas de imprimir" className={`${base} -ml-px rounded-r-md`}>
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void run(() => { const r = monthRange(date); return printRange(r.from, r.to) })}>Imprimir este mes</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void run(() => { const r = monthRange(date, 1); return printRange(r.from, r.to) })}>Imprimir el mes que viene</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setRangeOpen(true)}>Imprimir otras fechas…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <PrintRangeDialog open={rangeOpen} onOpenChange={setRangeOpen} date={date} />
    </>
  );
};

export default PrintWeekButton;
