import { describe, it, expect } from 'vitest'
import { googleCalendarUrl, icsContent } from './calendarLinks'

const event = { title: 'Uñas acrílicas en Yumi, Manicure', startsAt: '2031-02-10T14:00:00.000Z', endsAt: '2031-02-10T16:30:00.000Z', details: 'Con Laura\nTe esperamos; no faltes', location: 'Yumi Manicure' }

describe('guardar la cita en el calendario', () => {
  it('el enlace de Google lleva título, fechas en UTC, detalles y lugar', () => {
    const url = new URL(googleCalendarUrl(event))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe('Uñas acrílicas en Yumi, Manicure')
    expect(url.searchParams.get('dates')).toBe('20310210T140000Z/20310210T163000Z')
    expect(url.searchParams.get('details')).toBe('Con Laura\nTe esperamos; no faltes')
    expect(url.searchParams.get('location')).toBe('Yumi Manicure')
  })

  it('el archivo .ics es válido, escapa el texto y avisa una hora antes', () => {
    const ics = icsContent(event, new Date('2031-02-01T00:00:00Z'))
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('DTSTART:20310210T140000Z')
    expect(ics).toContain('DTEND:20310210T163000Z')
    expect(ics).toContain('SUMMARY:Uñas acrílicas en Yumi\\, Manicure')
    expect(ics).toContain('DESCRIPTION:Con Laura\\nTe esperamos\\; no faltes')
    expect(ics).toContain('TRIGGER:-PT1H')
    expect(ics).toMatch(/UID:.+@afilao/)
  })

  it('el mismo evento siempre produce el mismo UID (volver a añadirlo no lo duplica)', () => {
    const uid = (s: string) => s.match(/UID:(.+)\r\n/)![1]
    expect(uid(icsContent(event))).toBe(uid(icsContent(event)))
  })
})
