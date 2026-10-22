import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import MyProfile from './MyProfile'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { getAccessToken, setAccessToken } from '../lib/session'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'
import { panelSettings } from '../test/fixtures'

const owner = { id: 'u1', email: 'dueno@demo.com', name: 'Yoel Dueño', role: 'OWNER', tenantId: 't1' }

// Como en la app real, la pantalla se monta cuando la sesión ya se recuperó (la ruta espera al usuario).
const Gate = () => {
  const { isLoading } = useAuth()
  return isLoading ? null : <MyProfile />
}

// AuthProvider recupera la sesión con la cookie: se simula la marca de sesión y el refresh.
function open(role = 'OWNER') {
  localStorage.setItem('hasSession', '1')
  server.use(
    http.post(`${API}/auth/refresh`, () => HttpResponse.json({ user: { ...owner, role }, token: 'tok-inicial' })),
    http.get(`${API}/settings/booking`, () => HttpResponse.json(panelSettings())),
  )
  return renderWithProviders(
    <AuthProvider>
      <Gate />
    </AuthProvider>,
  )
}

describe('Mi perfil', () => {
  it('muestra tu nombre, tu rol en español y el salón, sin datos de empresa inventados', async () => {
    open()
    expect(await screen.findByText('Yoel Dueño')).toBeInTheDocument()
    expect(screen.getByText('Dueño')).toBeInTheDocument()
    expect(await screen.findByText('Tu cuenta en Barbería Demo.')).toBeInTheDocument()
    expect(screen.queryByText(/contact@company\.com|Tax ID|Información de la Empresa/)).not.toBeInTheDocument()
    setAccessToken(null)
  })

  it('guardar los datos solo se habilita si cambiaste algo, y envía nombre y correo', async () => {
    const puts: Array<Record<string, unknown>> = []
    server.use(
      http.put(`${API}/portal/my-profile`, async ({ request }) => {
        puts.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json({ ...owner, name: 'Yoel Nuevo' })
      }),
    )
    const user = userEvent.setup()
    open()
    const save = await screen.findByRole('button', { name: 'Guardar cambios' })
    expect(save).toBeDisabled()
    const name = screen.getByLabelText('Nombre')
    await user.clear(name)
    await user.type(name, 'Yoel Nuevo')
    expect(save).toBeEnabled()
    await user.click(save)
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]).toEqual({ name: 'Yoel Nuevo', email: 'dueno@demo.com' })
    setAccessToken(null)
  })

  it('cambiar la contraseña: valida longitud y coincidencia antes de enviar', async () => {
    const posts: unknown[] = []
    server.use(http.post(`${API}/auth/change-password`, async ({ request }) => { posts.push(await request.json()); return HttpResponse.json({ token: 'x' }) }))
    const user = userEvent.setup()
    open()
    await screen.findByText('Yoel Dueño')
    await user.type(screen.getByLabelText('Contraseña actual'), 'Temporal123')
    await user.type(screen.getByLabelText(/Contraseña nueva/), 'corta')
    await user.type(screen.getByLabelText('Repite la contraseña nueva'), 'corta')
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('al menos 8 caracteres')

    await user.clear(screen.getByLabelText(/Contraseña nueva/))
    await user.type(screen.getByLabelText(/Contraseña nueva/), 'NuevaClave456')
    await user.clear(screen.getByLabelText('Repite la contraseña nueva'))
    await user.type(screen.getByLabelText('Repite la contraseña nueva'), 'OtraDistinta1')
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('no coinciden')
    expect(posts).toHaveLength(0)
    setAccessToken(null)
  })

  it('un cambio correcto envía la actual y la nueva, guarda el token nuevo y limpia el formulario', async () => {
    const posts: unknown[] = []
    server.use(http.post(`${API}/auth/change-password`, async ({ request }) => { posts.push(await request.json()); return HttpResponse.json({ token: 'tok-nuevo' }) }))
    const user = userEvent.setup()
    open()
    await screen.findByText('Yoel Dueño')
    await user.type(screen.getByLabelText('Contraseña actual'), 'Temporal123')
    await user.type(screen.getByLabelText(/Contraseña nueva/), 'NuevaClave456')
    await user.type(screen.getByLabelText('Repite la contraseña nueva'), 'NuevaClave456')
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ currentPassword: 'Temporal123', newPassword: 'NuevaClave456' })
    await waitFor(() => expect(getAccessToken()).toBe('tok-nuevo'))
    expect(screen.getByLabelText('Contraseña actual')).toHaveValue('')
    setAccessToken(null)
  })

  it('si la contraseña actual es incorrecta muestra el motivo del servidor', async () => {
    server.use(http.post(`${API}/auth/change-password`, () => HttpResponse.json({ error: 'La contraseña actual no es correcta' }, { status: 400 })))
    const user = userEvent.setup()
    open()
    await screen.findByText('Yoel Dueño')
    await user.type(screen.getByLabelText('Contraseña actual'), 'mala')
    await user.type(screen.getByLabelText(/Contraseña nueva/), 'NuevaClave456')
    await user.type(screen.getByLabelText('Repite la contraseña nueva'), 'NuevaClave456')
    await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña actual no es correcta')
    setAccessToken(null)
  })

  it('un profesional ve su rol como «Profesional»', async () => {
    open('STAFF')
    expect(await screen.findByText('Profesional')).toBeInTheDocument()
    setAccessToken(null)
  })

  describe('calendario suscrito', () => {
    const feedMock = (active: boolean) => {
      const calls: string[] = []
      server.use(
        http.get(`${API}/calendar-feed`, () => HttpResponse.json({ active, createdAt: active ? '2026-10-20T10:00:00Z' : null, lastUsedAt: null })),
        http.post(`${API}/calendar-feed`, () => {
          calls.push('POST')
          return HttpResponse.json({ active: true, url: 'https://api.afilao.app/api/calendar/ABC123tokensecretoABC123tokensecreto123.ics' }, { status: 201 })
        }),
        http.delete(`${API}/calendar-feed`, () => {
          calls.push('DELETE')
          return new HttpResponse(null, { status: 204 })
        }),
      )
      return calls
    }

    it('activar muestra el enlace una sola vez, con instrucciones para Google, iPhone y Outlook', async () => {
      const calls = feedMock(false)
      const user = userEvent.setup()
      open()
      await user.click(await screen.findByRole('button', { name: 'Activar mi calendario' }))
      expect(await screen.findByTestId('enlace-calendario')).toHaveTextContent('https://api.afilao.app/api/calendar/ABC123tokensecreto')
      expect(screen.getByText(/Otros calendarios/)).toBeInTheDocument()
      expect(screen.getByText(/Añadir calendario suscrito/)).toBeInTheDocument()
      expect(screen.getByText(/Suscribirse desde la web/)).toBeInTheDocument()
      expect(calls).toEqual(['POST'])
    })

    it('con el calendario ya activo no vuelve a mostrar el enlace; permite generar otro o desactivar', async () => {
      const calls = feedMock(true)
      const user = userEvent.setup()
      open()
      expect(await screen.findByText(/Tu calendario está activo/)).toBeInTheDocument()
      expect(screen.queryByTestId('enlace-calendario')).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Desactivar' }))
      await waitFor(() => expect(calls).toEqual(['DELETE']))
    })

    it('un profesional ve que son solo sus citas', async () => {
      feedMock(false)
      open('STAFF')
      expect(await screen.findByText(/Suscribe tus citas/)).toBeInTheDocument()
    })
  })
})
