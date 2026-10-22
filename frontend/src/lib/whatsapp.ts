import { format } from 'date-fns';
import { es } from 'date-fns/locale/es';

/**
 * Número listo para wa.me: solo dígitos y con prefijo de país. Un móvil cubano de 8 cifras
 * que empieza por 5 (5xxxxxxx) se completa con el 53; el resto se deja como viene.
 */
export function whatsappPhone(raw?: string | null): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  if (digits.length === 8 && digits.startsWith('5')) return `53${digits}`;
  return digits;
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
