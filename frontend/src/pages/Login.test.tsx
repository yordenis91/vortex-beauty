import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import Login from './Login'
import { AuthProvider } from '../contexts/AuthContext'
import { getAccessToken, setAccessToken } from '../lib/session'
import { renderPage } from '../test/render'
import { server, API } from '../test/server'

const open = (route: string, path = '/:tenantSlug/login') =>
  renderPage(
    <AuthProvider>
      <Login />
    </AuthProvider>,
    { path, route, extraRoutes: { '/': <p>PANEL</p> } },
  )

const user = (role = 'OWNER') => ({ id: 'u1', email: 'dueno@demo.com', name: 'Dueño', role, tenantId: 't1' })

describe('Inicio de sesión del salón', () => {
  it('con el slug en la URL no lo pide y lo envía con las credenciales', async () => {
    const bodies: unknown[] = []
    server.use(
      http.post(`${API}/auth/login`, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ user: user(), token: 'jwt-123' })
      }),
    )
    const u = userEvent.setup()
    open('/Barberia-Demo/login')
    expect(screen.queryByPlaceholderText(/Código del salón/)).not.toBeInTheDocument()
    await u.type(await screen.findByPlaceholderText('Dirección de correo electrónico'), 'dueno@demo.com')
    await u.type(screen.getByPlaceholderText('Contraseña'), 'clave-larga-1')
    await u.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(await screen.findByText('PANEL')).toBeInTheDocument() // navegó a «/»
    expect(bodies[0]).toEqual({ email: 'dueno@demo.com', password: 'clave-larga-1', tenantSlug: 'barberia-demo' }) // el slug de la URL, en minúsculas
    expect(getAccessToken()).toBe('jwt-123')
    expect(localStorage.getItem('hasSession')).toBe('1')
    expect(localStorage.getItem('tenantSlug')).toBe('barberia-demo')
    setAccessToken(null)
  })

  it('en /login pide el código del salón, y lo normaliza a minúsculas', async () => {
    const bodies: Array<{ tenantSlug: string }> = []
    server.use(
      http.post(`${API}/auth/login`, async ({ request }) => {
        bodies.push((await request.json()) as { tenantSlug: string })
        return HttpResponse.json({ user: user(), token: 'jwt' })
      }),
    )
    const u = userEvent.setup()
    open('/login', '/login')
    await u.type(await screen.findByPlaceholderText(/Código del salón/), '  Mi-Salon ')
    await u.type(screen.getByPlaceholderText('Dirección de correo electrónico'), 'a@b.co')
    await u.type(screen.getByPlaceholderText('Contraseña'), 'x')
    await u.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0].tenantSlug).toBe('mi-salon')
    setAccessToken(null)
  })

  it('credenciales incorrectas muestran el error y no entran', async () => {
    server.use(http.post(`${API}/auth/login`, () => HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })))
    const u = userEvent.setup()
    open('/barberia-demo/login')
    await u.type(await screen.findByPlaceholderText('Dirección de correo electrónico'), 'dueno@demo.com')
    await u.type(screen.getByPlaceholderText('Contraseña'), 'mala')
    await u.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('Salón, correo electrónico o contraseña inválidos')).toBeInTheDocument()
    expect(screen.queryByText('PANEL')).not.toBeInTheDocument()
    expect(getAccessToken()).toBeNull()
    expect(localStorage.getItem('hasSession')).toBeNull()
  })
})
