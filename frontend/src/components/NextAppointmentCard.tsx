import React from 'react';
import { Link } from 'react-router-dom';
import { Check, MessageCircle, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { useAppointmentActions } from '../hooks/useAppointmentActions';
import { untilText, type NextAppointment } from '../lib/agenda';
import { confirmationMessage, whatsappLink } from '../lib/whatsapp';

interface Props {
  next: NextAppointment;
  today: string;
  salonName?: string;
  appointmentWord: string;
}

/** Lo que toca hacer ahora: la cita en curso o la siguiente, con contacto y «Completar» a un toque. */
const NextAppointmentCard: React.FC<Props> = ({ next, today, salonName, appointmentWord }) => {
  const { setStatus } = useAppointmentActions();
  const a = next.appointment;
  const day = a.date.split('T')[0];
  const phone = a.client?.phone ?? null;
  const wa = whatsappLink(phone, confirmationMessage({ clientName: a.client?.name, salonName, serviceName: a.serviceName, date: day, time: a.startTime }));

  const when =
    next.state === 'now'
      ? `En curso desde las ${a.startTime}`
      : day === today
        ? `Hoy a las ${a.startTime} · ${untilText(next.minutesUntil ?? 0)}`
        : `${format(new Date(`${day}T00:00:00`), "EEEE d 'de' MMMM", { locale: es }).replace(/^./, (c) => c.toUpperCase())}, ${a.startTime}`;

  return (
    <section aria-label={`Siguiente ${appointmentWord}`} className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{next.state === 'now' ? 'Ahora' : `Siguiente ${appointmentWord}`}</p>
      <h2 className="mt-1 text-xl font-semibold leading-tight text-foreground">{a.client?.name ?? 'Cliente'}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {a.serviceName} · {a.startTime}–{a.endTime}
        {a.professional ? ` · ${a.professional.name}` : ''}
      </p>
      <p className="mt-2 text-base font-medium text-foreground">{when}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {phone && (
          <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted">
            <Phone className="h-4 w-4" /> Llamar
          </a>
        )}
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted">
            <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp
          </a>
        )}
        {next.state === 'now' && (
          <button type="button" onClick={() => setStatus(a, 'COMPLETED')} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">
            <Check className="h-4 w-4" /> Completar
          </button>
        )}
        <Link to={`/admin/appointments?fecha=${day}&cita=${a.id}`} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-blue-700 hover:underline">
          Ver en la agenda
        </Link>
      </div>
    </section>
  );
};

export default NextAppointmentCard;
