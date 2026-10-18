import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import NewTenantDialog from './NewTenantDialog'
import { renderWithProviders } from '../../test/render'
import { server, API } from '../../test/server'

const P = `${API}/platform`

type Body = Record<string, unknown> & { services?: unknown; hours?: Array<{ dayOfWeek: number; isOpen: boolean }> }
const hours = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, isOpen: d !== 0, startTime: '09:00', endTime: '18:00' }))
const templates = {
  BARBER: {
    services: [
      { name: 'Corte de cabello', price: 15, durationMinutes: 30, category: 'Cortes' },
      { name: 'Corte + barba', price: 22, durationMinutes: 45, category: 'Cortes' },
      { name: 'Arreglo de barba', price: 10, durationMinutes: 20, category: 'Barba' },
    ],
    professional: 'Barbero principal',
    resources: ['Silla 1'],
    labels: {},
  },
  NAILS: {
    services: [{ name: 'Manicura básica', price: 25, durationMinutes: 45, category: 'Manicura' }],
    professional: 'Manicurista principal',
    resources: [],
    labels: {},
  },
}
const plans = [
  { id: 'p-pro', name: 'Pro', slug: 'pro', maxStaff: 10, priceMonthly: 20, priceYearly: 200, currency: 'USD', trialDays: 0, features: [], isActive: true, isPublic: true },
  { id: 'p-free', name: 'Free', slug: 'free', maxStaff: 1, priceMonthly: 0, priceYearly: 0, currency: 'USD', trialDays: 0, features: [], isActive: true, isPublic: true },
]

function mockApi(created: Record<string, unknown> | null = null, taken = ['ocupado']) {
  const posted: Body[] = []
  server.use(
    http.get(`${P}/plans`, () => HttpResponse.json(plans)),
    http.get(`${P}/tenants/templates`, () => HttpResponse.json({ templates, hours })),
    http.get(`${P}/tenants/slug-available`, ({ request }) => {
      const slug = new URL(request.url).searchParams.get('slug')!
      return HttpResponse.json(taken.includes(slug) ? { slug, available: false, reason: `Ya existe un salón con el identificador "${slug}"` } : { slug, available: true, reason: null })
    }),
    http.post(`${P}/tenants`, async ({ request }) => {
      posted.push((await request.json()) as Body)
      return HttpResponse.json(
        created ?? {
          tenant: { id: 't1', name: 'Barbería El Elegante', slug: 'barberia-el-elegante' },
          admin: { id: 'u1', email: 'yoel@example.com', name: 'Yoel Prueba' },
          telegram: null,
          tempPassword: 'Temp1234abcd',
          loginUrl: '/barberia-el-elegante/login',
        },
        { status: 201 },
      )
    }),
  )
  return posted
}

const open = () => renderWithProviders(<NewTenantDialog open onOpenChange={() => {}} />)

async function fillStep1(user: ReturnType<typeof userEvent.setup>, name = 'Barbería El Elegante') {
  await user.type(await screen.findByPlaceholderText('Barbería El Elegante'), name)
  await screen.findByText('✓ Disponible')
}
const next = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Siguiente' }))

describe('Asistente de alta de salón', () => {
  it('el identificador se genera del nombre (sin acentos) y se comprueba en vivo', async () => {
    mockApi()
    const user = userEvent.setup()
    open()
    await fillStep1(user)
    expect(screen.getByPlaceholderText('barberia-el-elegante')).toHaveValue('barberia-el-elegante')
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled()
  })

  it('un identificador ocupado o reservado bloquea el avance y explica por qué', async () => {
    mockApi()
    const user = userEvent.setup()
    open()
    await user.type(await screen.findByPlaceholderText('Barbería El Elegante'), 'Ocupado')
    expect(await screen.findByText(/Ya existe un salón con el identificador "ocupado"/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })

  it('el paso 2 viene precargado con la plantilla del oficio, y cambiar de oficio la cambia', async () => {
    mockApi()
    const user = userEvent.setup()
    open()
    await fillStep1(user)
    await user.selectOptions(screen.getByDisplayValue('Barbería'), 'NAILS')
    await next(user)
    expect(await screen.findByLabelText('Servicio 1')).toHaveValue('Manicura básica')
    expect(screen.getByLabelText('Profesional 1')).toHaveValue('Manicurista principal')
    expect(screen.queryByLabelText('Servicio 2')).not.toBeInTheDocument()
  })

  it('no deja avanzar sin días abiertos, sin servicios o con más profesionales de los que admite el plan', async () => {
    mockApi()
    const user = userEvent.setup()
    open()
    await fillStep1(user)
    await user.selectOptions(screen.getByDisplayValue('Pro'), 'p-free') // admite 1
    await next(user)

    await screen.findByLabelText('Servicio 1')
    await user.click(screen.getByText('Añadir', { exact: true }))
    await user.type(screen.getByLabelText('Profesional 2'), 'Raúl')
    expect(screen.getByText(/El plan Free admite hasta 1/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    await user.click(screen.getAllByLabelText('Quitar profesional')[0])
    await waitFor(() => expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled())

    // sin ningún día abierto
    for (const day of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']) await user.click(screen.getByLabelText(day))
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    await user.click(screen.getByLabelText('Lunes'))
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled()

    // un servicio sin precio tampoco
    await user.clear(screen.getByLabelText('Precio 1'))
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })

  it('crea el salón con lo configurado y entrega el mensaje para el dueño', async () => {
    const posted = mockApi()
    const user = userEvent.setup()
    open()
    await fillStep1(user)
    await user.selectOptions(screen.getByDisplayValue('CUP'), 'USD')
    await next(user)

    await user.clear(screen.getByLabelText('Precio 1'))
    await user.type(screen.getByLabelText('Precio 1'), '500')
    await user.click(screen.getAllByLabelText('Quitar servicio')[2]) // quita «Arreglo de barba»
    await user.clear(screen.getByLabelText('Profesional 1'))
    await user.type(screen.getByLabelText('Profesional 1'), 'Yoel')
    await user.click(screen.getByLabelText('Domingo'))
    await next(user)

    const inputs = screen.getAllByRole('textbox')
    await user.type(inputs[0], 'Yoel Prueba')
    await user.type(inputs[1], 'yoel@example.com')
    await user.click(screen.getByRole('button', { name: 'Crear salón' }))

    expect(await screen.findByText(/Salón creado: Barbería El Elegante/)).toBeInTheDocument()
    const body = posted[0]
    expect(body).toMatchObject({
      name: 'Barbería El Elegante',
      slug: 'barberia-el-elegante',
      planId: 'p-pro',
      vertical: 'BARBER',
      timezone: 'America/Havana',
      currency: 'USD',
      adminName: 'Yoel Prueba',
      adminEmail: 'yoel@example.com',
      professionals: ['Yoel'],
    })
    expect(body.services).toEqual([
      { name: 'Corte de cabello', price: 500, durationMinutes: 30 },
      { name: 'Corte + barba', price: 22, durationMinutes: 45 },
    ])
    expect(body.hours!.find((h) => h.dayOfWeek === 0)!.isOpen).toBe(true) // domingo abierto
    expect(body).not.toHaveProperty('telegramBotToken')

    const message = screen.getByText(/Hola Yoel Prueba/, { selector: 'pre' }).textContent!
    expect(message).toContain(`${window.location.origin}/r/barberia-el-elegante`)
    expect(message).toContain(`${window.location.origin}/barberia-el-elegante/login`)
    expect(message).toContain('Correo: yoel@example.com')
    expect(message).toContain('Contraseña temporal: Temp1234abcd')
    expect(await screen.findByRole('img', { name: 'Código QR de reservas' })).toBeInTheDocument()
  })

  it('copia el mensaje al portapapeles', async () => {
    mockApi()
    const user = userEvent.setup()
    open()
    await fillStep1(user)
    await next(user)
    await screen.findByLabelText('Servicio 1')
    await next(user)
    const inputs = screen.getAllByRole('textbox')
    await user.type(inputs[0], 'Yoel Prueba')
    await user.type(inputs[1], 'yoel@example.com')
    await user.click(screen.getByRole('button', { name: 'Crear salón' }))
    await screen.findByText(/Salón creado/)
    await user.click(screen.getByRole('button', { name: /Copiar mensaje/ }))
    expect(await navigator.clipboard.readText()).toContain('Contraseña temporal: Temp1234abcd')
  })

  it('si el bot no se pudo conectar, el salón existe y se avisa; con bot conectado da el comando /vincular', async () => {
    mockApi({
      tenant: { id: 't1', name: 'Barbería El Elegante', slug: 'barberia-el-elegante' },
      admin: { id: 'u1', email: 'yoel@example.com', name: 'Yoel Prueba' },
      telegram: { ok: false, error: 'Telegram no reconoce ese token.' },
      tempPassword: 'Temp1234abcd',
      loginUrl: '/barberia-el-elegante/login',
    })
    const user = userEvent.setup()
    open()
    await fillStep1(user)
    await next(user)
    await screen.findByLabelText('Servicio 1')
    await next(user)
    const inputs = screen.getAllByRole('textbox')
    await user.type(inputs[0], 'Yoel Prueba')
    await user.type(inputs[1], 'yoel@example.com')
    await user.click(screen.getByRole('button', { name: 'Crear salón' }))
    const warn = await screen.findByText(/el bot de Telegram no se conectó/)
    expect(warn).toHaveTextContent('Telegram no reconoce ese token.')
  })

  it('con el bot conectado, el mensaje incluye cómo enlazar al dueño', async () => {
    const posted = mockApi({
      tenant: { id: 't1', name: 'Barbería El Elegante', slug: 'barberia-el-elegante' },
      admin: { id: 'u1', email: 'yoel@example.com', name: 'Yoel Prueba' },
      telegram: { ok: true, botUsername: 'elegante_bot', ownerCode: 'A1B2C3D4' },
      tempPassword: 'Temp1234abcd',
      loginUrl: '/barberia-el-elegante/login',
    })
    const user = userEvent.setup()
    open()
    await fillStep1(user)
    await next(user)
    await screen.findByLabelText('Servicio 1')
    await next(user)
    const inputs = screen.getAllByRole('textbox')
    await user.type(inputs[0], 'Yoel Prueba')
    await user.type(inputs[1], 'yoel@example.com')
    await user.type(document.querySelector('input[type=password]')!, '123456:ABC-token')
    await user.click(screen.getByRole('button', { name: 'Crear salón' }))
    await screen.findByText(/Bot @elegante_bot conectado/)
    expect(posted[0].telegramBotToken).toBe('123456:ABC-token')
    expect(screen.getByText(/Hola Yoel Prueba/, { selector: 'pre' }).textContent).toContain('@elegante_bot en Telegram y escríbele: /vincular A1B2C3D4')
  })

  it('«Atrás» conserva lo escrito', async () => {
    mockApi()
    const user = userEvent.setup()
    open()
    await fillStep1(user)
    await next(user)
    await screen.findByLabelText('Servicio 1')
    await user.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(screen.getByPlaceholderText('Barbería El Elegante')).toHaveValue('Barbería El Elegante')
  })
})
