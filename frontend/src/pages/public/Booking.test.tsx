import { describe, it, expect } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addMonths, format, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale/es'
import { delay, http, HttpResponse } from 'msw'
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
          endsAt: '2030-03-04T15:00:00.000Z',
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
  await waitFor(() => expect(document.querySelector('td[data-day] button:not([disabled])')).not.toBeNull(), { timeout: 8000 })
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
      customer: { name: 'Marta Pérez', phone: '+5355551234' },
      website: '', // el campo trampa llega vacío
    })
  }, 15000)

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
        endsAt: '2030-03-04T14:30:00.000Z',
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

  it('al confirmar ofrece guardar la cita en Google Calendar o como archivo .ics', async () => {
    const posted = mockBooking()
    void posted
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: /Corte de cabello/ }))
    await user.click(await firstEnabledDay())
    await user.click(await screen.findByRole('button', { name: '09:00' }))
    await user.type(screen.getByLabelText(/Nombre/), 'Marta')
    await user.type(screen.getByLabelText('Teléfono'), '5555')
    await user.click(screen.getByRole('button', { name: 'Confirmar turno' }))
    const group = await screen.findByRole('group', { name: 'Añadir a mi calendario' })
    const google = new URL(within(group).getByRole('link', { name: 'Google Calendar' }).getAttribute('href')!)
    expect(google.searchParams.get('text')).toBe('Corte de cabello en Barbería Demo')
    expect(google.searchParams.get('dates')).toMatch(/^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/)
    expect(within(group).getByRole('button', { name: /\.ics/ })).toBeInTheDocument()
  }, 15000)
})

describe('Reserva pública · calendario', () => {
  const calendarGroup = () => screen.getByRole('group', { name: 'Calendario de días disponibles' })
  const monthLabel = () => calendarGroup().querySelector('p[aria-live]')!.textContent
  const labelOf = (offset: number) => format(addMonths(new Date(), offset), 'LLLL yyyy', { locale: es })
  const swipe = (fromX: number, toX: number, fromY = 100, toY = 100) => {
    fireEvent.touchStart(calendarGroup(), { touches: [{ clientX: fromX, clientY: fromY }] })
    fireEvent.touchEnd(calendarGroup(), { changedTouches: [{ clientX: toX, clientY: toY }] })
  }
  const toDateStep = async (user: ReturnType<typeof userEvent.setup>) => {
    open()
    await user.click(await screen.findByRole('button', { name: /Corte de cabello/ }))
    await firstEnabledDay()
  }

  it('mientras llegan los días con huecos muestra un esqueleto y no deja elegir ninguno', async () => {
    mockBooking()
    server.use(
      http.get(`${BASE}/calendar`, async ({ request }) => {
        await delay(200)
        const q = new URL(request.url).searchParams
        return HttpResponse.json({ availableDates: datesBetween(q.get('from')!, q.get('to')!) })
      }),
    )
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: /Corte de cabello/ }))

    expect(await screen.findByRole('status', { name: 'Cargando días disponibles' })).toBeInTheDocument()
    expect(document.querySelectorAll('td[data-day] button')).toHaveLength(0) // ni un solo día tocable hasta saber cuáles hay

    await firstEnabledDay()
    expect(screen.queryByRole('status', { name: 'Cargando días disponibles' })).toBeNull()
  })

  it('pide el calendario al elegir el servicio y precarga el mes siguiente', async () => {
    const requested: string[] = []
    mockBooking()
    server.use(
      http.get(`${BASE}/calendar`, ({ request }) => {
        const q = new URL(request.url).searchParams
        requested.push(q.get('from')!)
        return HttpResponse.json({ availableDates: datesBetween(q.get('from')!, q.get('to')!) })
      }),
    )
    const user = userEvent.setup()
    await toDateStep(user)
    const firstOfNextMonth = format(startOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd')
    await waitFor(() => expect(requested).toContain(firstOfNextMonth))
    // cambiar al mes precargado no vuelve a pedir nada
    const before = requested.length
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    expect(monthLabel()).toBe(labelOf(1))
    await firstEnabledDay()
    expect(requested.filter((from) => from === firstOfNextMonth)).toHaveLength(1)
    expect(before).toBeGreaterThan(1)
  })

  it('con varios profesionales no pide el calendario hasta saber con quién', async () => {
    const requested: Array<string | null> = []
    mockBooking({
      catalog: catalog({
        professionals: [
          { id: 'p-yoel', name: 'Yoel', color: null, serviceIds: ['s-corte'] },
          { id: 'p-raul', name: 'Raúl', color: null, serviceIds: ['s-corte'] },
        ],
      }),
    })
    server.use(
      http.get(`${BASE}/calendar`, ({ request }) => {
        const q = new URL(request.url).searchParams
        requested.push(q.get('professionalId'))
        return HttpResponse.json({ availableDates: datesBetween(q.get('from')!, q.get('to')!) })
      }),
    )
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: /Corte de cabello/ }))
    await screen.findByText('¿Con quién?')
    expect(requested).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: /Raúl/ }))
    await firstEnabledDay()
    expect(new Set(requested)).toEqual(new Set(['p-raul']))
  })

  it('deslizar hacia los lados cambia de mes; un gesto corto o más vertical que horizontal no hace nada', async () => {
    mockBooking()
    await toDateStep(userEvent.setup())
    expect(monthLabel()).toBe(labelOf(0))

    swipe(330, 90) // hacia la izquierda: mes siguiente
    expect(monthLabel()).toBe(labelOf(1))
    swipe(90, 330) // hacia la derecha: mes anterior
    expect(monthLabel()).toBe(labelOf(0))

    swipe(90, 330) // ya es el mes actual: no se puede ir al pasado
    expect(monthLabel()).toBe(labelOf(0))
    swipe(200, 170) // demasiado corto
    expect(monthLabel()).toBe(labelOf(0))
    swipe(300, 150, 100, 260) // más vertical que horizontal (es un scroll, no un deslizamiento)
    expect(monthLabel()).toBe(labelOf(0))
  })

  it('las flechas respetan los límites: no hay mes anterior al actual ni posterior al máximo reservable', async () => {
    mockBooking({ catalog: catalog({ maxAdvanceDays: 0 }) })
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: /Corte de cabello/ }))
    await screen.findByText('Elige el día')
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled()
    swipe(330, 90)
    expect(monthLabel()).toBe(labelOf(0))
  })

  it('si el mes no tiene días libres lo dice y ofrece saltar al siguiente', async () => {
    mockBooking()
    const thisMonth = format(new Date(), 'yyyy-MM')
    server.use(
      http.get(`${BASE}/calendar`, ({ request }) => {
        const q = new URL(request.url).searchParams
        const dates = q.get('from')!.startsWith(thisMonth) ? [] : datesBetween(q.get('from')!, q.get('to')!)
        return HttpResponse.json({ availableDates: dates })
      }),
    )
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: /Corte de cabello/ }))
    expect(await screen.findByText(/No hay días disponibles en/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Ver / }))
    expect(monthLabel()).toBe(labelOf(1))
    await firstEnabledDay()
  })

  it('si falla la carga de los días lo avisa y deja reintentar, en vez de mostrar días que quizá no estén libres', async () => {
    mockBooking()
    let fail = true
    server.use(
      http.get(`${BASE}/calendar`, ({ request }) => {
        if (fail) return HttpResponse.json({ error: 'boom' }, { status: 500 })
        const q = new URL(request.url).searchParams
        return HttpResponse.json({ availableDates: datesBetween(q.get('from')!, q.get('to')!) })
      }),
    )
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: /Corte de cabello/ }))
    expect(await screen.findByText('No pudimos cargar los días disponibles.')).toBeInTheDocument()
    expect(document.querySelectorAll('td[data-day] button')).toHaveLength(0)
    fail = false
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    await firstEnabledDay()
  })
})

describe('Reserva pública · fichas y pasos', () => {
  it('el paso de la hora pide expresamente elegir la hora y recuerda la duración', async () => {
    mockBooking()
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: /Corte de cabello/ }))
    await user.click(await firstEnabledDay())
    expect(await screen.findByText(/Selecciona la hora de tu turno/)).toHaveTextContent('dura 30 min')
  })

  it('con horarios en mañana, tarde y noche los separa por rótulos', async () => {
    const slotsAt = (times: string[]) => http.get(`${BASE}/availability`, () => HttpResponse.json({ slots: times.map((startTime) => ({ startTime })), reason: null }))
    mockBooking()
    server.use(slotsAt(['09:00', '13:00', '19:30']))
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: /Corte de cabello/ }))
    await user.click(await firstEnabledDay())
    await screen.findByRole('button', { name: '13:00' })
    expect(screen.getByText('Mañana')).toBeInTheDocument()
    expect(screen.getByText('Tarde')).toBeInTheDocument()
    expect(screen.getByText('Noche')).toBeInTheDocument()
  })

  it('con una sola franja horaria no muestra rótulos', async () => {
    mockBooking()
    server.use(http.get(`${BASE}/availability`, () => HttpResponse.json({ slots: [{ startTime: '09:00' }, { startTime: '10:00' }], reason: null })))
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: /Corte de cabello/ }))
    await user.click(await firstEnabledDay())
    await screen.findByRole('button', { name: '10:00' })
    expect(screen.queryByText('Mañana')).toBeNull()
  })

  it('la barra de progreso refleja el paso en el que vas', async () => {
    mockBooking()
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: /Corte de cabello/ }))
    const bar = await screen.findByRole('progressbar', { name: 'Progreso de la reserva' })
    expect(bar).toHaveAttribute('aria-valuenow', '2')
    expect(bar).toHaveAttribute('aria-valuemax', '4')
  })

  it('las categorías empiezan abiertas y se pliegan y despliegan sin perder los servicios', async () => {
    mockBooking()
    const user = userEvent.setup()
    open()
    const header = await screen.findByRole('button', { name: /^Cortes/ })
    const panel = document.getElementById(header.getAttribute('aria-controls')!)!
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(panel.querySelector('[inert]')).toBeNull()

    await user.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(panel.querySelector('[inert]')).not.toBeNull() // plegada: el teclado y los lectores no llegan a servicios ocultos
    // otra categoría no se ve afectada
    expect(screen.getByRole('button', { name: /^Barba/ })).toHaveAttribute('aria-expanded', 'true')

    await user.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(panel.querySelector('[inert]')).toBeNull()
    expect(within(panel).getByRole('button', { name: /Corte de cabello/ })).toBeInTheDocument()
  })

  it('con una sola categoría no hay nada que plegar', async () => {
    mockBooking({
      catalog: catalog({
        services: [
          { id: 's-corte', name: 'Corte de cabello', description: null, price: '500', currency: 'CUP', durationMinutes: 30, category: null },
          { id: 's-barba', name: 'Arreglo de barba', description: null, price: '300', currency: 'CUP', durationMinutes: 20, category: null },
        ],
      }),
    })
    open()
    const header = await screen.findByRole('button', { name: /^Servicios/ })
    expect(header).toBeDisabled()
    expect(header).toHaveAttribute('aria-expanded', 'true')
  })
})
