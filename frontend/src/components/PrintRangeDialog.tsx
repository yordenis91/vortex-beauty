import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MAX_PRINT_DAYS, printRange, rangeProblem } from '../lib/printWeek';

const inputClass = 'mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500';

/** «Imprimir otras fechas»: la agenda entre dos días a elegir (hasta 92). Arranca en el día que se está viendo. */
const PrintRangeDialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void; date: Date }> = ({ open, onOpenChange, date }) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    const day = format(date, 'yyyy-MM-dd');
    setFrom(day);
    setTo(day);
    setTried(false);
  }, [open, date]);

  const problem = rangeProblem(from, to);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (problem) return;
    setBusy(true);
    try {
      if (await printRange(from, to)) onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Imprimir otras fechas</DialogTitle>
          <DialogDescription>Elige desde qué día hasta cuál. Máximo {MAX_PRINT_DAYS} días. Los días sin citas no salen en la hoja.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-foreground">
              Desde
              <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Hasta
              <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          {tried && problem && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {problem}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
              Cancelar
            </button>
            <button type="submit" disabled={busy} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {busy ? 'Preparando…' : 'Imprimir'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PrintRangeDialog;
