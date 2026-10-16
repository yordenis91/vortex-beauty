import { instantToLocal } from '../../lib/time';

export const appointmentInclude = { client: true, service: true, professional: true, resource: true } as const;

/**
 * Añade a la cita los campos de hora local que usa la interfaz (`date`,
 * `startTime`, `endTime`), calculados con la zona horaria del salón. En la base
 * solo se guardan instantes absolutos.
 */
export function toAppointmentDto<T extends { startsAt: Date; endsAt: Date }>(appointment: T, timezone: string) {
  const start = instantToLocal(timezone, appointment.startsAt);
  const end = instantToLocal(timezone, appointment.endsAt);
  return {
    ...appointment,
    date: `${start.dateStr}T00:00:00.000Z`,
    startTime: start.time,
    endTime: end.time,
  };
}
