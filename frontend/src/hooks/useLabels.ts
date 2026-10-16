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
  return {
    label: (key: string, capitalize = false) => {
      const value = labels[key] ?? key;
      return capitalize ? value.charAt(0).toUpperCase() + value.slice(1) : value;
    },
    salonName: data?.name,
  };
}
