import { describe, it, expect } from 'vitest';
import { buildIcs, fold, icsText } from '../lib/ics';
import { summaryText } from '../services/notifications/templates';

describe('iCalendar', () => {
  it('escapa comas, punto y coma, barras y saltos de línea', () => {
    expect(icsText('Uñas, pies; y manos\\n\nnota')).toBe('Uñas\\, pies\; y manos\\\\n\\nnota');
  });

  it('parte las líneas largas a 75 bytes sin cortar caracteres a la mitad', () => {
    const line = `SUMMARY:${'ñ'.repeat(80)}`;
    const folded = fold(line).split('\r\n');
    expect(folded.length).toBeGreaterThan(1);
    for (const part of folded) expect(Buffer.byteLength(part)).toBeLessThanOrEqual(75);
    expect(folded.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line);
  });

  it('genera un calendario con eventos en UTC, UID estable y citas canceladas marcadas', () => {
    const ics = buildIcs('Citas · Yumi', [
      { uid: 'a1@afilao', startsAt: new Date('2031-02-10T14:00:00Z'), endsAt: new Date('2031-02-10T16:30:00Z'), summary: 'Yadira · Acrílicas', description: 'Teléfono: +53 5 555 1234', location: 'Yumi' },
      { uid: 'a2@afilao', startsAt: new Date('2031-02-11T14:00:00Z'), endsAt: new Date('2031-02-11T15:00:00Z'), summary: 'María · Corte', cancelled: true },
    ], new Date('2031-02-01T00:00:00Z'));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20310210T140000Z');
    expect(ics).toContain('DTEND:20310210T163000Z');
    expect(ics).toContain('UID:a1@afilao');
    expect(ics).toContain('SUMMARY:Yadira · Acrílicas');
    expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics).toContain('STATUS:CANCELLED');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});

describe('texto del resumen diario', () => {
  const lines = [
    { time: '09:00', client: 'Yadira', service: 'Uñas acrílicas', professional: 'Laura', pending: false },
    { time: '13:00', client: 'María', service: 'Pedicura', professional: null, pending: true },
  ];
  it('cuenta, ordena y marca lo pendiente; el dueño ve quién atiende', () => {
    const text = summaryText('Yumi Manicure', '2031-02-10', { one: 'cita', many: 'citas' }, lines, true);
    expect(text).toBe('☀️ Yumi Manicure: 2 citas hoy, lunes 10 de febrero\n\n• 09:00 · Yadira · Uñas acrílicas (Laura)\n• 13:00 · María · Pedicura — pendiente de confirmar');
  });
  it('en singular y sin nombres de profesional para quien solo ve lo suyo', () => {
    const text = summaryText('Yumi', '2031-02-10', { one: 'cita', many: 'citas' }, [lines[0]], false);
    expect(text).toContain('1 cita hoy');
    expect(text).not.toContain('(Laura)');
  });
});
