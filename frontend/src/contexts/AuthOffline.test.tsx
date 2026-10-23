import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { AuthProvider, useAuth } from './AuthContext'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'

const saved = { id: 'u1', email: 'dueno@demo.com', name: 'Yoel Dueño', role: 'OWNER' }

const Who = () => {
  const { user, isLoading } = useAuth()
  return <p data-testid="quien">{isLoading ? 'cargando' : user ? user.name : 'sin sesión'}</p>
}
const open = () => renderWithProviders(<AuthProvider><Who /></AuthProvider>)

describe('abrir la app sin conexión', () => {
  it('con sesión de antes y sin red, entra con el usuario guardado (sin pedir el login)', async () => {
    localStorage.setItem('hasSession', '1')
    localStorage.setItem('afilao-user', JSON.stringify(saved))
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.error()))
    open()
    expect(await screen.findByText('Yoel Dueño')).toBeInTheDocument()
    expect(localStorage.getItem('hasSession')).toBe('1') // la sesión sigue viva
  })

  it('sin red y sin usuario guardado, pide iniciar sesión', async () => {
    localStorage.setItem('hasSession', '1')
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.error()))
    open()
    expect(await screen.findByText('sin sesión')).toBeInTheDocument()
  })

  it('si el servidor dice que la sesión terminó (401), no se usa lo guardado y se borra', async () => {
    localStorage.setItem('hasSession', '1')
    localStorage.setItem('afilao-user', JSON.stringify(saved))
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.json({ error: 'Sesión caducada' }, { status: 401 })))
    open()
    expect(await screen.findByText('sin sesión')).toBeInTheDocument()
    expect(localStorage.getItem('afilao-user')).toBeNull()
    expect(localStorage.getItem('hasSession')).toBeNull()
  })

  it('con red, renueva la sesión y guarda al usuario para la próxima vez sin conexión', async () => {
    localStorage.setItem('hasSession', '1')
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.json({ user: saved, token: 'tok' })))
    open()
    expect(await screen.findByText('Yoel Dueño')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('afilao-user')!)).toMatchObject({ id: 'u1', role: 'OWNER' })
  })
})
