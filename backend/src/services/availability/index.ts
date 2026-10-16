export * from './errors';
export * from './booking';
export { computeSlots } from './engine';
export type { Slot, SlotQuery, SlotsResult } from './engine';
export { appointmentInclude, toAppointmentDto } from './dto';

import { toBookingHttpError } from './errors';

/** Como toBookingHttpError, pero relanza los errores que no son de reservas (los atrapa el manejador global). */
export function toBookingHttpErrorOrThrow(error: unknown): { status: number; message: string } {
  const handled = toBookingHttpError(error);
  if (!handled) {
    console.error('Error en reservas:', error);
    return { status: 500, message: 'Error interno del servidor' };
  }
  return handled;
}
