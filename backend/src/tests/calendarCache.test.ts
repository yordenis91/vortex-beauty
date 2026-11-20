import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cachedCalendar, clearCalendarCache, setCalendarCacheTtl } from '../lib/calendarCache';
import { safeLogUrl } from '../lib/logger';

describe('safeLogUrl', () => {
  it('oculta el token del enlace de gestionar la cita y quita la query', () => {
    expect(safeLogUrl('/api/public/booking/yumi/manage/glNGOuiMRIRlJbeVLaKXfPD_XVhu3L2MWN8LJHOKM2s')).toBe('/api/public/booking/yumi/manage/[oculto]');
    expect(safeLogUrl('/api/public/booking/yumi/manage/abc_DEF-123/availability?date=2026-12-01')).toBe('/api/public/booking/yumi/manage/[oculto]/availability');
    expect(safeLogUrl('/api/public/booking/yumi/manage/abc_DEF-123/cancel')).toBe('/api/public/booking/yumi/manage/[oculto]/cancel');
  });

  it('oculta el token del enlace del calendario del celular', () => {
    expect(safeLogUrl('/api/calendar/9f8e7d6c5b4a.ics')).toBe('/api/calendar/[oculto].ics');
  });

  it('deja intactas las demás rutas', () => {
    expect(safeLogUrl('/api/appointments?week=2026-W47')).toBe('/api/appointments');
    expect(safeLogUrl('/api/public/booking/yumi/calendar')).toBe('/api/public/booking/yumi/calendar');
    expect(safeLogUrl(undefined)).toBeUndefined();
  });
});

describe('caché del calendario público', () => {
  beforeEach(() => setCalendarCacheTtl(60_000));
  afterEach(() => setCalendarCacheTtl(0));

  it('la segunda petición idéntica no vuelve a calcular', async () => {
    let calls = 0;
    const compute = async () => {
      calls++;
      return ['2026-12-07'];
    };
    expect(await cachedCalendar('a', 't1', compute)).toEqual(['2026-12-07']);
    expect(await cachedCalendar('a', 't1', compute)).toEqual(['2026-12-07']);
    expect(calls).toBe(1);
  });

  it('peticiones simultáneas comparten un solo cálculo', async () => {
    let calls = 0;
    const compute = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return [];
    };
    await Promise.all([cachedCalendar('a', 't1', compute), cachedCalendar('a', 't1', compute), cachedCalendar('a', 't1', compute)]);
    expect(calls).toBe(1);
  });

  it('distingue salones y parámetros', async () => {
    let calls = 0;
    const compute = async () => ++calls && [];
    await cachedCalendar('a', 't1', compute);
    await cachedCalendar('b', 't1', compute);
    await cachedCalendar('a', 't2', compute);
    expect(calls).toBe(3);
  });

  it('clearCalendarCache vacía solo ese salón', async () => {
    let calls = 0;
    const compute = async () => ++calls && [];
    await cachedCalendar('a', 't1', compute);
    await cachedCalendar('a', 't2', compute);
    clearCalendarCache('t1');
    await cachedCalendar('a', 't1', compute);
    await cachedCalendar('a', 't2', compute);
    expect(calls).toBe(3);
  });

  it('un error no se guarda: la siguiente petición reintenta', async () => {
    let calls = 0;
    const flaky = async () => {
      calls++;
      if (calls === 1) throw new Error('falló');
      return ['2026-12-14'];
    };
    await expect(cachedCalendar('a', 't1', flaky)).rejects.toThrow('falló');
    await new Promise((r) => setTimeout(r, 0));
    expect(await cachedCalendar('a', 't1', flaky)).toEqual(['2026-12-14']);
  });

  it('con TTL 0 no cachea', async () => {
    setCalendarCacheTtl(0);
    let calls = 0;
    const compute = async () => ++calls && [];
    await cachedCalendar('a', 't1', compute);
    await cachedCalendar('a', 't1', compute);
    expect(calls).toBe(2);
  });
});
