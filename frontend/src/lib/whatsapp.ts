import { normalizePhone } from './phone';
import { format } from 'date-fns';
import { es } from 'date-fns/locale/es';

/**
 * Número listo para wa.me: solo dígitos y con prefijo de país (+53 si no lo trae; ver lib/phone).
 */
export function whatsappPhone(raw?: string | null): string | null {
  return normalizePhone(raw)?.slice(1) ?? null;
}

export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  const number = whatsappPhone(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}

export interface MessageInput {
  clientName?: string | null;
  salonName?: string | null;
  serviceName: string;
  /** Día de la cita, yyyy-MM-dd. */
  date: string;
  time: string;
}

const dayLabel = (date: string) => format(new Date(`${date}T00:00:00`), "EEEE d 'de' MMMM", { locale: es });

/** Mensaje de confirmación de una cita, listo para enviar. */
export function confirmationMessage(m: MessageInput): string {
  const first = (m.clientName ?? '').trim().split(/\s+/)[0];
  const where = m.salonName ? ` en ${m.salonName}` : '';
  return `Hola${first ? ` ${first}` : ''}, te confirmo tu cita${where}: ${m.serviceName}, ${dayLabel(m.date)} a las ${m.time}. ¡Te esperamos!`;
}
