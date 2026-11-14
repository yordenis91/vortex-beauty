import type { AppointmentStatus } from '../types';

/** Etiqueta y colores (claro y oscuro) con los que se muestra el estado de una cita en listas compactas. */
export const APPOINTMENT_STATUS: Record<AppointmentStatus, { label: string; chip: string; dot: string }> = {
  PENDING: {
    label: 'Pendiente',
    chip: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
    dot: 'bg-amber-500',
  },
  SCHEDULED: {
    label: 'Agendada',
    chip: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
    dot: 'bg-sky-500',
  },
  COMPLETED: {
    label: 'Completada',
    chip: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900',
    dot: 'bg-green-500',
  },
  CANCELLED: {
    label: 'Cancelada',
    chip: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
    dot: 'bg-red-500',
  },
  NO_SHOW: {
    label: 'No asistió',
    chip: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-gray-500',
  },
};
