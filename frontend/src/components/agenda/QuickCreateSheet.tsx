import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Loader2, UserPlus, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useAdminSlots, useClients, useCreateAppointment, useCreateClient, useServices } from '../../hooks/useQueries';
import type { Professional } from '../../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { parseYmd } from '../../lib/agenda';

export interface CreatePreset {
  date: string;
  time?: string;
  clientId?: string;
  serviceId?: string;
  professionalId?: string;
}

interface Props {
  preset: CreatePreset | null;
  professionals: Professional[];
  words: { appointment: string };
  onClose: () => void;
}

const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${on ? 'border-blue-600 bg-blue-600 text-white' : 'border-border bg-card text-foreground hover:bg-muted'}`;

/** Cita nueva en pocos toques: cliente (buscar o crear al vuelo), servicio y hora. */
const QuickCreateSheet: React.FC<Props> = ({ preset, professionals, words, onClose }) => (
  <Drawer open={!!preset} onOpenChange={(open) => !open && onClose()}>
    <DrawerContent>{preset && <Form key={`${preset.date}-${preset.time ?? ''}-${preset.clientId ?? ''}`} {...{ preset, professionals, words, onClose }} />}</DrawerContent>
  </Drawer>
);

const Form: React.FC<Omit<Props, 'preset'> & { preset: CreatePreset }> = ({ preset, professionals, words, onClose }) => {
  const { data: clients = [] } = useClients();
  const { data: allServices = [] } = useServices();
  const services = useMemo(() => allServices.filter((s) => s.status === 'ACTIVE'), [allServices]);

  const [clientId, setClientId] = useState(preset.clientId ?? '');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [serviceId, setServiceId] = useState(preset.serviceId ?? '');
  const [professionalId, setProfessionalId] = useState(preset.professionalId ?? '');
  const [date, setDate] = useState(preset.date);
  const [time, setTime] = useState(preset.time ?? '');
  const [notes, setNotes] = useState('');

  const { data: slots = [], isLoading: slotsLoading } = useAdminSlots(date, serviceId, professionalId || 'any');
  const createClient = useCreateClient();
  const createAppointment = useCreateAppointment();
  const busy = createClient.isPending || createAppointment.isPending;

  const client = clients.find((c) => c.id === clientId);
  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => (q.length < 1 ? [] : clients.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').replace(/\D/g, '').includes(q.replace(/\D/g, '') || '§')).slice(0, 5)),
    [clients, q]
  );
  const exact = clients.some((c) => c.name.toLowerCase() === q);
  const times = slots.map((s) => s.startTime);
  const hasClient = !!client || (creating && query.trim().length > 0 && newPhone.trim().length > 0);
  const ready = hasClient && !!serviceId && !!time && times.includes(time);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    try {
      let id = clientId;
      if (!id) {
        const created = await createClient.mutateAsync({ name: query.trim(), phone: newPhone.trim() });
        id = created.id;
      }
      await createAppointment.mutateAsync({
        clientId: id,
        serviceId,
        date: new Date(date).toISOString(),
        startTime: time,
        professionalId: professionalId || 'any',
        notes,
        status: 'SCHEDULED',
      });
      toast.success(`Se creó ${words.appointment === 'cita' ? 'la cita' : `el ${words.appointment}`}`);
      onClose();
    } catch {
      // los hooks ya muestran el motivo
    }
  };

  const label = 'mb-2 block text-sm font-semibold text-foreground';

  return (
    <form onSubmit={submit} className="flex max-h-[85dvh] flex-col">
      <DrawerHeader className="text-left">
        <DrawerTitle className="text-xl">Nueva {words.appointment}</DrawerTitle>
        <DrawerDescription>{format(parseYmd(date), "EEEE d 'de' MMMM", { locale: es })}</DrawerDescription>
      </DrawerHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
        <div>
          <span className={label}>Cliente</span>
          {client ? (
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/50 px-4 py-3">
              <span className="font-medium">{client.name}</span>
              <button type="button" aria-label="Cambiar cliente" onClick={() => { setClientId(''); setQuery(''); }} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <input
                aria-label="Buscar o escribir el nombre del cliente"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setCreating(false); }}
                placeholder="Nombre o teléfono del cliente"
                autoComplete="off"
                className="h-12 w-full rounded-xl border border-border bg-card px-4 text-base"
              />
              {matches.length > 0 && (
                <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
                  {matches.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => setClientId(c.id)} className="flex min-h-12 w-full flex-col items-start px-4 py-2 text-left hover:bg-muted">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.phone || c.email || 'Sin contacto'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query.trim() && !exact && !creating && (
                <button type="button" onClick={() => setCreating(true)} className="mt-2 flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium text-blue-700">
                  <UserPlus className="h-4 w-4" /> Crear cliente «{query.trim()}»
                </button>
              )}
              {creating && (
                <input
                  aria-label="Teléfono del cliente nuevo"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Teléfono del cliente nuevo"
                  inputMode="tel"
                  className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4 text-base"
                />
              )}
            </>
          )}
        </div>

        <div>
          <span className={label}>Servicio</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Servicio">
            {services.map((s) => (
              <button key={s.id} type="button" aria-pressed={serviceId === s.id} onClick={() => { setServiceId(s.id); setTime(''); }} className={chip(serviceId === s.id)}>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {professionals.length > 1 && (
          <div>
            <span className={label}>Con quién</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Profesional">
              <button type="button" aria-pressed={!professionalId} onClick={() => { setProfessionalId(''); setTime(''); }} className={chip(!professionalId)}>Cualquiera</button>
              {professionals.map((p) => (
                <button key={p.id} type="button" aria-pressed={professionalId === p.id} onClick={() => { setProfessionalId(p.id); setTime(''); }} className={chip(professionalId === p.id)}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="qc-date" className={label}>Día</label>
          <input id="qc-date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setTime(''); }} className="h-12 w-full rounded-xl border border-border bg-card px-4 text-base" />
        </div>

        <div>
          <span className={label}>Hora</span>
          {!serviceId ? (
            <p className="text-sm text-muted-foreground">Elige primero un servicio.</p>
          ) : slotsLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Buscando horas…</p>
          ) : times.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay horas libres ese día. Prueba con otro día.</p>
          ) : (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Hora">
              {times.map((t) => (
                <button key={t} type="button" aria-pressed={time === t} onClick={() => setTime(t)} className={chip(time === t)}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="qc-notes" className={label}>Nota (opcional)</label>
          <input id="qc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-12 w-full rounded-xl border border-border bg-card px-4 text-base" />
        </div>
      </div>

      <div className="border-t border-border bg-background px-4 py-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <button type="submit" disabled={!ready || busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-base font-semibold text-white disabled:opacity-50">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Agendar
        </button>
      </div>
    </form>
  );
};

export default QuickCreateSheet;
