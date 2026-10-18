import { useBookingSettings } from './useQueries';

/** Vocabulario por defecto; cada salón lo sobrescribe en Ajustes (clienta/cliente, cita/turno...). */
const DEFAULT_LABELS: Record<string, string> = {
  customer: 'cliente',
  customers: 'clientes',
  appointment: 'cita',
  appointments: 'citas',
  professional: 'profesional',
  professionals: 'profesionales',
  service: 'servicio',
  services: 'servicios',
};

/**
 * Devuelve `label(key)` con el vocabulario del salón. `label('customers', true)`
 * lo devuelve con la primera letra en mayúscula.
 */
export function useLabels() {
  const { data } = useBookingSettings();
  const labels = { ...DEFAULT_LABELS, ...(data?.labels ?? {}) };
  // Femenino si la palabra (singular) acaba en -a, -ión o -dad: cita, reserva, sesión.
  const isFeminine = (key: string) => /(a|ión|dad)$/i.test(labels[key.replace(/s$/, '')] ?? labels[key] ?? '');
  return {
    /** Concuerda un adjetivo con el vocabulario: agree('completad', 'appointments') → completadas / completados. */
    agree: (stem: string, key: string) => `${stem}${isFeminine(key) ? 'a' : 'o'}${key.endsWith('s') ? 's' : ''}`,
    /** Palabra con su artículo: the('appointment') → la cita / el turno; the('appointments') → las citas / los turnos. */
    the: (key: string) => {
      const plural = key.endsWith('s');
      const article = isFeminine(key) ? (plural ? 'las' : 'la') : plural ? 'los' : 'el';
      return `${article} ${labels[key] ?? key}`;
    },
    label: (key: string, capitalize = false) => {
      const value = labels[key] ?? key;
      return capitalize ? value.charAt(0).toUpperCase() + value.slice(1) : value;
    },
    salonName: data?.name,
  };
}
