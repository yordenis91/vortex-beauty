import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Lock } from 'lucide-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useCreateTimeOff } from '../../hooks/useQueries';
import type { Professional } from '../../types';
import { localToIso, parseYmd } from '../../lib/agenda';
import { format } from 'date-fns';
import { es } from 'date-fns/locale/es';

interface Props {
  date: string | null;
  professionals: Professional[];
  professionalId?: string;
  timezone: string;
  onClose: () => void;
}

/** Bloquear unas horas de un día (almuerzo, trámite, descanso) para que nadie reserve ahí. */
const BlockHoursSheet: React.FC<Props> = ({ date, professionals, professionalId, timezone, onClose }) => (
  <Drawer open={!!date} onOpenChange={(open) => !open && onClose()}>
    <DrawerContent>{date && <Form key={date} {...{ date, professionals, professionalId, timezone, onClose }} />}</DrawerContent>
  </Drawer>
);

const field = 'h-12 w-full rounded-xl border border-border bg-card px-4 text-base';

const Form: React.FC<Omit<Props, 'date'> & { date: string }> = ({ date, professionals, professionalId, timezone, onClose }) => {
  const [pro, setPro] = useState(professionalId || (professionals.length === 1 ? professionals[0].id : ''));
  const [from, setFrom] = useState('12:00');
  const [to, setTo] = useState('13:00');
  const [reason, setReason] = useState('');
  const create = useCreateTimeOff({
    onSuccess: () => {
      toast.success('Horas bloqueadas');
      onClose();
    },
  });

  const valid = !!pro && from < to;

  const submit = (e: React.FormEvent, force = false) => {
    e.preventDefault();
    if (!valid || create.isPending) return;
    create.mutate({ professionalId: pro, startsAt: localToIso(timezone, date, from), endsAt: localToIso(timezone, date, to), reason: reason.trim() || undefined, force });
  };

  return (
    <form onSubmit={submit} className="flex flex-col">
      <DrawerHeader className="text-left">
        <DrawerTitle className="text-xl">Bloquear horas</DrawerTitle>
        <DrawerDescription>{format(parseYmd(date), "EEEE d 'de' MMMM", { locale: es })}. Nadie podrá reservar en ese rato.</DrawerDescription>
      </DrawerHeader>
      <div className="space-y-4 px-4 pb-4">
        {professionals.length > 1 && (
          <div>
            <label htmlFor="bh-pro" className="mb-2 block text-sm font-semibold">Quién no atiende</label>
            <select id="bh-pro" value={pro} onChange={(e) => setPro(e.target.value)} className={field}>
              <option value="">Elige una persona</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="bh-from" className="mb-2 block text-sm font-semibold">Desde</label>
            <input id="bh-from" type="time" value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
          </div>
          <div>
            <label htmlFor="bh-to" className="mb-2 block text-sm font-semibold">Hasta</label>
            <input id="bh-to" type="time" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
          </div>
        </div>
        {from >= to && <p className="text-sm text-red-600">La hora de fin debe ser después de la de inicio.</p>}
        <div>
          <label htmlFor="bh-reason" className="mb-2 block text-sm font-semibold">Motivo (opcional)</label>
          <input id="bh-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Almuerzo, trámite…" className={field} />
        </div>
      </div>
      <div className="border-t border-border px-4 py-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <button type="submit" disabled={!valid || create.isPending} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-base font-semibold text-white disabled:opacity-50">
          {create.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />} Bloquear
        </button>
      </div>
    </form>
  );
};

export default BlockHoursSheet;
