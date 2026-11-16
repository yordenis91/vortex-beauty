import type { Appointment } from '../types';

/** Citas que se anotaron primero en el cuaderno (origen PAPEL). Es solo una marca informativa. */
export const isFromPaper = (a: Pick<Appointment, 'source'> | null | undefined): boolean => a?.source === 'PAPEL';
