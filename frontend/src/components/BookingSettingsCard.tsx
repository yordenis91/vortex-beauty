import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useBookingSettings, useUpdateBookingSettings } from '../hooks/useQueries';
import type { BookingSettings } from '../types';

const VERTICALS: Array<{ value: BookingSettings['vertical']; label: string; words: Record<string, string> }> = [
  { value: 'GENERIC', label: 'Otro negocio con citas', words: { customer: 'cliente', customers: 'clientes', appointment: 'cita', appointments: 'citas', professional: 'profesional', professionals: 'profesionales' } },
  { value: 'NAILS', label: 'Manicura y uñas', words: { customer: 'clienta', customers: 'clientas', appointment: 'cita', appointments: 'citas', professional: 'manicurista', professionals: 'manicuristas' } },
  { value: 'BARBER', label: 'Barbería', words: { customer: 'cliente', customers: 'clientes', appointment: 'turno', appointments: 'turnos', professional: 'barbero', professionals: 'barberos' } },
  { value: 'HAIR', label: 'Peluquería', words: { customer: 'cliente', customers: 'clientes', appointment: 'cita', appointments: 'citas', professional: 'estilista', professionals: 'estilistas' } },
  { value: 'SPA', label: 'Spa y masajes', words: { customer: 'cliente', customers: 'clientes', appointment: 'reserva', appointments: 'reservas', professional: 'terapeuta', professionals: 'terapeutas' } },
  { value: 'TATTOO', label: 'Tatuajes', words: { customer: 'cliente', customers: 'clientes', appointment: 'sesión', appointments: 'sesiones', professional: 'tatuador', professionals: 'tatuadores' } },
  { value: 'FITNESS', label: 'Entrenamiento personal', words: { customer: 'cliente', customers: 'clientes', appointment: 'sesión', appointments: 'sesiones', professional: 'entrenador', professionals: 'entrenadores' } },
];

const LABEL_FIELDS: Array<[string, string]> = [
  ['customer', 'Cliente (singular)'],
  ['customers', 'Clientes (plural)'],
  ['appointment', 'Cita (singular)'],
  ['appointments', 'Citas (plural)'],
  ['professional', 'Profesional (singular)'],
  ['professionals', 'Profesionales (plural)'],
];

const TIMEZONES = [
  'America/Havana', 'America/Mexico_City', 'America/Bogota', 'America/Lima', 'America/Caracas', 'America/Santiago',
  'America/Argentina/Buenos_Aires', 'America/Sao_Paulo', 'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'America/Panama', 'America/Santo_Domingo', 'Europe/Madrid', 'UTC',
];

const inputClass = 'w-full px-3 py-2 border border-border rounded-lg bg-card focus:ring-2 focus:ring-blue-500 outline-none';

const BookingSettingsCard: React.FC = () => {
  const { data, isLoading } = useBookingSettings();
  const [form, setForm] = useState<BookingSettings | null>(null);
  const update = useUpdateBookingSettings({ onSuccess: () => toast.success('Ajustes de reserva guardados') });

  useEffect(() => {
    // Se copia el valor del servidor a un borrador editable cuando llega.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (data) setForm(data);
  }, [data]);

  if (isLoading || !form) return null;

  const set = <K extends keyof BookingSettings>(key: K, value: BookingSettings[K]) => setForm({ ...form, [key]: value });

  const applyVertical = (vertical: BookingSettings['vertical']) => {
    const preset = VERTICALS.find((v) => v.value === vertical);
    setForm({ ...form, vertical, labels: { ...form.labels, ...(preset?.words ?? {}) } });
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate({
      timezone: form.timezone,
      vertical: form.vertical,
      slotIntervalMin: form.slotIntervalMin,
      minNoticeHours: form.minNoticeHours,
      maxAdvanceDays: form.maxAdvanceDays,
      cancelWindowHrs: form.cancelWindowHrs,
      bookingEnabled: form.bookingEnabled,
      labels: form.labels,
    });
  };

  const num = (value: string) => Math.max(0, parseInt(value) || 0);

  return (
    <form onSubmit={save} className="bg-card shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 border-b border-border">
        <h3 className="text-lg leading-6 font-medium text-foreground">Reservas y vocabulario</h3>
        <p className="mt-1 text-sm text-muted-foreground">Cómo reservan tus clientes y cómo se llama cada cosa en tu negocio.</p>
      </div>
      <div className="px-4 py-5 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tipo de negocio</label>
            <select className={inputClass} value={form.vertical} onChange={(e) => applyVertical(e.target.value as BookingSettings['vertical'])}>
              {VERTICALS.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">Cambiarlo ajusta el vocabulario; tus servicios y horarios no se tocan.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Zona horaria</label>
            <select className={inputClass} value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
              {[...new Set([form.timezone, ...TIMEZONES])].map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Un hueco cada (minutos)</label>
            <input type="number" min={5} max={240} step={5} className={inputClass} value={form.slotIntervalMin} onChange={(e) => set('slotIntervalMin', num(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Antelación mínima para reservar (horas)</label>
            <input type="number" min={0} className={inputClass} value={form.minNoticeHours} onChange={(e) => set('minNoticeHours', num(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reservas hasta (días hacia adelante)</label>
            <input type="number" min={1} className={inputClass} value={form.maxAdvanceDays} onChange={(e) => set('maxAdvanceDays', Math.max(1, num(e.target.value)))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">El cliente puede cancelar hasta (horas antes)</label>
            <input type="number" min={0} className={inputClass} value={form.cancelWindowHrs} onChange={(e) => set('cancelWindowHrs', num(e.target.value))} />
            <p className="mt-1 text-xs text-muted-foreground">0 = puede cancelar siempre.</p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.bookingEnabled} onChange={(e) => set('bookingEnabled', e.target.checked)} />
          Aceptar reservas en línea
        </label>

        <div>
          <h4 className="text-sm font-semibold mb-2">Vocabulario</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {LABEL_FIELDS.map(([key, text]) => (
              <div key={key}>
                <label className="block text-xs text-muted-foreground mb-1">{text}</label>
                <input
                  className={inputClass}
                  value={form.labels[key] ?? ''}
                  maxLength={40}
                  onChange={(e) => set('labels', { ...form.labels, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="px-4 py-3 sm:px-6 border-t border-border flex justify-end">
        <button type="submit" disabled={update.isPending} className="px-6 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
          {update.isPending ? 'Guardando...' : 'Guardar ajustes'}
        </button>
      </div>
    </form>
  );
};

export default BookingSettingsCard;
