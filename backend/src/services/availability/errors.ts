import { Prisma } from '@prisma/client';

export class AvailabilityError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** true si Postgres abortó por conflicto de serialización (P2034 / 40001). */
export function isSerializationConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return true;
  const text = errorText(error);
  return /could not serialize access|40001/.test(text);
}

/** true si la restricción EXCLUDE de Appointment rechazó un solape (SQLSTATE 23P01). */
export function isOverlapViolation(error: unknown): boolean {
  return /appointment_no_overlap|exclusion constraint|23P01/i.test(errorText(error));
}

function errorText(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error);
  const e = error as { message?: string; code?: string; cause?: unknown };
  return [e.message, e.code, e.cause ? errorText(e.cause) : ''].join(' ');
}

/** Convierte cualquier error de reserva conocido en {status, message}; null si no es de reservas. */
export function toBookingHttpError(error: unknown): { status: number; message: string } | null {
  if (error instanceof AvailabilityError) return { status: error.status, message: error.message };
  // Límite del plan (ver services/planLimits.ts)
  if (error instanceof Error && error.name === 'PlanLimitError') return { status: 402, message: error.message };
  if (isSerializationConflict(error) || isOverlapViolation(error)) {
    return { status: 409, message: 'Alguien reservó ese horario justo antes. Prueba con otro horario.' };
  }
  return null;
}
