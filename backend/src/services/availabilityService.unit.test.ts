import { describe, it, expect } from 'vitest';
import { timeToMinutes, dayOfWeekFromDateString, dayRangeUTC } from './availabilityService';

describe('timeToMinutes', () => {
  it('convierte HH:mm a minutos desde medianoche', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('09:30')).toBe(570);
    expect(timeToMinutes('23:59')).toBe(1439);
  });
});

describe('dayOfWeekFromDateString', () => {
  // Antes había dos criterios distintos conviviendo en el código
  // (getDay() local vs getUTCDay()), y podían dar días distintos para la
  // misma fecha según el huso horario del servidor. Esta prueba fija el
  // comportamiento correcto: la fecha se lee como fecha de calendario.
  it('siempre da el mismo día sin importar la hora del sistema', () => {
    // 2026-08-17 es lunes.
    expect(dayOfWeekFromDateString('2026-08-17')).toBe(1);
    // 2026-08-16 es domingo.
    expect(dayOfWeekFromDateString('2026-08-16')).toBe(0);
    // 2026-08-22 es sábado.
    expect(dayOfWeekFromDateString('2026-08-22')).toBe(6);
  });

  it('no varía aunque TZ del proceso cambie (regresión del bug de husos horarios)', () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = 'Pacific/Kiritimati'; // UTC+14
      const kiritimati = dayOfWeekFromDateString('2026-08-17');
      process.env.TZ = 'Etc/GMT+12'; // UTC-12
      const etcMinus12 = dayOfWeekFromDateString('2026-08-17');
      expect(kiritimati).toBe(etcMinus12);
      expect(kiritimati).toBe(1);
    } finally {
      process.env.TZ = original;
    }
  });
});

describe('dayRangeUTC', () => {
  it('cubre exactamente el día en UTC, de 00:00:00.000 a 23:59:59.999', () => {
    const { start, end } = dayRangeUTC('2026-08-17');
    expect(start.toISOString()).toBe('2026-08-17T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-17T23:59:59.999Z');
  });
});
