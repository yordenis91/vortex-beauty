import { describe, it, expect } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import Booking from './Booking'
import { renderPage } from '../../test/render'
import { server, API } from '../../test/server'
import { catalog, datesBetween, SLUG } from '../../test/fixtures'

const BASE = `${API}/public/booking/${SLUG}`
const open = () => renderPage(<Booking />, { path: '/:tenantSlug/reservar', route: `/${SLUG}/reservar` })

/** Responde a catálogo, días con huecos y horas; devuelve lo que llegue a POST /bookings. */
function mockBooking(opts: { catalog?: ReturnType<typeof catalog>; postStatus?: number; postBody?: unknown } = {}) {
  const posted: unknown[] = []
  server.use(
    http.get(BASE, () => HttpResponse.json(opts.catalog ?? catalog())),
    http.get(`${BASE}/calendar`, ({ request }) => {
      const q = new URL(request.url).searchParams
      return HttpResponse.json({ availableDates: datesBetween(q.get('from')!, q.get('to')!) })
    }),
    http.get(`${BASE}/availability`, () => HttpResponse.json({ slots: [{ startTime: '09:00' }, { startTime: '09:30' }], reason: null })),
    http.post(`${BASE}/bookings`, async ({ request }) => {
      posted.push(await request.json())
      return HttpResponse.json(
        opts.postBody ?? {
          id: 'a1',
          status: 'SCHEDULED',
          serviceName: 'Corte de cabello',
          professionalName: 'Yoel',
          date: '2030-03-04T00:00:00.000Z',
          startTime: '09:30',
          endTime: '10:00',
          startsAt: '2030-03-04T14:30:00.000Z',
          priceAmount: '500',
          currency: 'CUP',
          manageUrl: '/barberia-demo/mi-cita/tok123',
          telegram: null,
        },
        { status: opts.postStatus ?? 201 },
      )
    }),
  )
  return posted
}

const firstEnabledDay = async () => {
  await screen.findByText('Elige el día')
  await waitFor(() => expect(document.querySelector('td[data-day] button:not([disabled])')).not.toBeNull())
  return document.querySelector<HTMLButtonElement>('td[data-day] button:not([disabled])')!
}

describe('Reserva pública', () => {
  it('muestra el negocio, el vocabulario del oficio y los servicios agrupados con su precio', async () => {
    mockBooking()
    open()
    expect(await screen.findByText('Barbería Demo')).toBeInTheDocument()
    expect(screen.getByText('Reserva tu turno en línea')).toBeInTheDocument()
    expect(screen.getByText('Cortes')).toBeInTheDocument()
    expect(screen.getByText('Barba')).toBeInTheDocument()
    const corte = screen.getByRole('button', { name: /Corte de cabello/ })
    expect(within(corte).getByText('500 CUP')).toBeInTheDocument()
    expect(within(corte).getByText('30 min')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Arreglo de barba/ })).toHaveTextContent('Con navaja')
  })

  it('un enlace de un negocio inexistente lo dice sin romperse', async () => {
    server.use(http.get(BASE, () => HttpResponse.json({ error: 'Salón no encontrado' }, { status: 404 })))
    open()
    expect(await screen.findByText(/No encontramos este negocio/)).toBeInTheDocument()
  })

  it('si el negocio no acepta reservas en línea, lo avisa', async () => {
    mockBooking({ catalog: catalog({ bookingEnabled: false }) })
    open()
    expect(await screen.findByText(/no acepta reservas en línea/)).toBeInTheDocument()
  })

  it('un negocio sin servicios muestra un mensaje en vez de una lista vacía', async () => {
    mockBooking({ catalog: catalog({ services: [] }) })
    open()
    expect(await screen.findByText(/aún no tiene servicios disponibles/)).toBeInTheDocument()
  })

  it('reserva completa: servicio → día → hora → datos → confirmación, enviando lo elegido', async () => {
    const posted = mockBooking()
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: /Corte de cabello/ }))

    const day = await firstEnabledDay()
    const iso = day.closest('td')!.getAttribute('data-day')!
    await user.click(day)

    await user.click(await screen.findByRole('button', { name: '09:30' }))
    expect(screen.getByText(/09:30/)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Nombre/), 'Marta Pérez')
    await user.type(screen.getByLabelText('Teléfono'), '+53 5 555 1234')
    await user.click(screen.getByRole('button', { name: 'Confirmar turno' }))

    expect(await screen.findByText('¡Listo! Ya tienes tu turno')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Cambiar o cancelar mi turno/ })).toHaveAttribute('href', '/barberia-demo/mi-cita/tok123')
    expect(posted).toHaveLength(1)
    expect(posted[0]).toMatchObject({
      serviceId: 's-corte',
      professionalId: 'p-yoel', // un solo profesional: se asigna sin preguntar
      date: iso,
      startTime: '09:30',
      customer: { name: 'Marta Pérez', phone: '+53 5 555 1234' },
      website: '', // el campo trampa llega vacío
    })
  })

  it('exige teléfono o correo antes de enviar', async () => {
    const posted = mockBooking()
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: /Corte de cabello/ }))
    await user.click(await firstEnabledDay())
    await user.click(await screen.findByRole('button', { name: '09:00' }))
    await user.type(screen.getByLabelText(/Nombre/), 'Marta')
    await user.click(screen.getByRole('button', { name: 'Confirmar turno' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Indica un teléfono o un correo')
    expect(posted).toHaveLength(0)
  })

  it('si el hueco se ocupó justo antes (409), muestra el motivo y vuelve a elegir hora', async () => {
    mockBooking({ postStatus: 409, postBody: { error: 'Ese horario ya no está disponible' } })
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: /Corte de cabello/ }))
    await user.click(await firstEnabledDay())
    await user.click(await screen.findByRole('button', { name: '09:00' }))
    await user.type(screen.getByLabelText(/Nombre/), 'Marta')
    await user.type(screen.getByLabelText('Correo (para enviarte la confirmación)'), 'marta@example.com')
    await user.click(screen.getByRole('button', { name: 'Confirmar turno' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ese horario ya no está disponible')
    // de vuelta en la lista de horas
    expect(await screen.findByRole('button', { name: '09:30' })).toBeInTheDocument()
  })

  it('con varios profesionales ofrece elegir, incluida la opción «cualquiera»', async () => {
    mockBooking({
      catalog: catalog({
        professionals: [
          { id: 'p-yoel', name: 'Yoel', color: null, serviceIds: ['s-corte'] },
          { id: 'p-raul', name: 'Raúl', color: null, serviceIds: ['s-corte'] },
        ],
      }),
    })
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: /Corte de cabello/ }))
    expect(await screen.findByText('¿Con quién?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Yoel/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Raúl/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Cualquiera disponible/ }))
    expect(await screen.findByText('Elige el día')).toBeInTheDocument()
  })

  it('muestra el paso en el que vas y el servicio elegido mientras eliges día y hora', async () => {
    mockBooking()
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: /Corte de cabello/ }))

    expect(await screen.findByText('Paso 2 de 4')).toBeInTheDocument() // un solo profesional: no hay paso para elegirlo
    expect(screen.getByText('Corte de cabello')).toBeInTheDocument() // el resumen del servicio

    await user.click(await firstEnabledDay())
    expect(await screen.findByText('Paso 3 de 4')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: '09:30' }))
    expect(await screen.findByText('Paso 4 de 4')).toBeInTheDocument()
  })

  it('con varios profesionales cuenta un paso más y muestra con quién se reserva', async () => {
    mockBooking({
      catalog: catalog({
        professionals: [
          { id: 'p-yoel', name: 'Yoel', color: null, serviceIds: ['s-corte'] },
          { id: 'p-raul', name: 'Raúl', color: null, serviceIds: ['s-corte'] },
        ],
      }),
    })
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: /Corte de cabello/ }))
    expect(await screen.findByText('Paso 2 de 5')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Raúl/ }))
    expect(await screen.findByText('Paso 3 de 5')).toBeInTheDocument()
    expect(screen.getByText(/· Raúl/)).toBeInTheDocument()
  })

  it('cada paso empieza arriba de la página', async () => {
    mockBooking()
    const scrolled: unknown[] = []
    const original = window.scrollTo
    window.scrollTo = ((arg: unknown) => { scrolled.push(arg) }) as typeof window.scrollTo
    try {
      const user = userEvent.setup()
      open()
      await user.click(await screen.findByRole('button', { name: /Corte de cabello/ }))
      await screen.findByText('Elige el día')
      expect(scrolled.length).toBeGreaterThan(1)
      expect(scrolled.at(-1)).toEqual({ top: 0 })
    } finally {
      window.scrollTo = original
    }
  })

  it('al confirmar se puede copiar el enlace para gestionar la cita', async () => {
    mockBooking()
    const user = userEvent.setup()
    const copied: string[] = []
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => { copied.push(t) } }, configurable: true })
    open()
    await user.click(await screen.findByRole('button', { name: /Corte de cabello/ }))
    await user.click(await firstEnabledDay())
    await user.click(await screen.findByRole('button', { name: '09:30' }))
    await user.type(screen.getByLabelText(/Nombre/), 'Marta Pérez')
    await user.type(screen.getByLabelText('Teléfono'), '+53 5 555 1234')
    await user.click(screen.getByRole('button', { name: 'Confirmar turno' }))
    await user.click(await screen.findByRole('button', { name: /Copiar enlace de mi turno/ }))
    await waitFor(() => expect(copied).toEqual([`${window.location.origin}/barberia-demo/mi-cita/tok123`]))
  })

  it('al confirmar ofrece activar los avisos por Telegram si el salón tiene bot', async () => {
    mockBooking({
      postBody: {
        id: 'a1',
        status: 'SCHEDULED',
        serviceName: 'Corte de cabello',
        professionalName: 'Yoel',
        date: '2030-03-04T00:00:00.000Z',
        startTime: '09:00',
        endTime: '09:30',
        startsAt: '2030-03-04T14:00:00.000Z',
        priceAmount: '500',
        currency: 'CUP',
        manageUrl: '/barberia-demo/mi-cita/tok123',
        telegram: { botUsername: 'barberia_bot', linked: false, deepLink: 'https://t.me/barberia_bot?start=tok123' },
      },
    })
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: /Corte de cabello/ }))
    await user.click(await firstEnabledDay())
    await user.click(await screen.findByRole('button', { name: '09:00' }))
    await user.type(screen.getByLabelText(/Nombre/), 'Marta')
    await user.type(screen.getByLabelText('Teléfono'), '5555')
    await user.click(screen.getByRole('button', { name: 'Confirmar turno' }))
    expect(await screen.findByRole('link', { name: /Recibir avisos por Telegram/ })).toHaveAttribute('href', 'https://t.me/barberia_bot?start=tok123')
  })
})
