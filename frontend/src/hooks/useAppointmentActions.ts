import { useQueryClient } from '@tanstack/react-query';
import type { Appointment, AppointmentStatus } from '../types';
import { useUpdateAppointment } from './useQueries';
import { useLabels } from './useLabels';
import { defer } from '../lib/deferred';
import { toastUndo } from '../lib/undoToast';
import { OFFLINE_MESSAGE, isOffline } from '../lib/offline';
import toast from 'react-hot-toast';

/** Tiempo que se espera antes de cancelar de verdad (para poder deshacer sin avisar al cliente). */
export const cancelDelay = { ms: 5000 };

/**
 * Cambios de estado de una cita con «Deshacer», sin cuadros de confirmación.
 * Cancelar avisa al cliente, así que se retrasa unos segundos: si te arrepientes, nunca se envía.
 * El resto (completar, no asistió, confirmar) se aplica al instante y se puede revertir.
 */
export function useAppointmentActions() {
  const queryClient = useQueryClient();
  const { label, agree } = useLabels();
  const mutation = useUpdateAppointment({ onSuccess: () => undefined });

  const noun = label('appointment', true);
  const messages: Record<AppointmentStatus, string> = {
    CANCELLED: `${noun} ${agree('cancelad', 'appointment')}`,
    COMPLETED: `${noun} ${agree('completad', 'appointment')}`,
    NO_SHOW: 'Marcado como «No asistió»',
    SCHEDULED: `${noun} ${agree('confirmad', 'appointment')}`,
    PENDING: `${noun} pendiente`,
  };

  const patchCache = (id: string, status: AppointmentStatus) =>
    queryClient.setQueriesData<Appointment[]>({ queryKey: ['appointments'] }, (list) =>
      Array.isArray(list) ? list.map((a) => (a.id === id ? { ...a, status } : a)) : list
    );

  const apply = (id: string, status: AppointmentStatus, onDone?: () => void) =>
    mutation.mutate(
      { id, appointmentData: { status } },
      {
        onSuccess: onDone,
        onError: () => void queryClient.invalidateQueries({ queryKey: ['appointments'] }),
      }
    );

  const setStatus = (appointment: Appointment, status: AppointmentStatus) => {
    const previous = appointment.status;
    if (status === previous) return;
    // Sin conexión no se cambia nada: ni el aviso con «Deshacer» ni el cambio visual a medias.
    if (isOffline()) {
      toast.error(OFFLINE_MESSAGE);
      return;
    }

    if (status === 'CANCELLED') {
      patchCache(appointment.id, 'CANCELLED');
      const cancelTimer = defer(`cancel-${appointment.id}`, () => apply(appointment.id, 'CANCELLED'), cancelDelay.ms);
      toastUndo(
        messages.CANCELLED,
        () => {
          cancelTimer();
          patchCache(appointment.id, previous);
        },
        cancelDelay.ms
      );
      return;
    }

    patchCache(appointment.id, status);
    apply(appointment.id, status, () =>
      toastUndo(messages[status], () => {
        patchCache(appointment.id, previous);
        apply(appointment.id, previous);
      })
    );
  };

  return { setStatus, isPending: mutation.isPending };
}
