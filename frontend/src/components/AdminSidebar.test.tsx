import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import AdminSidebar from './AdminSidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AuthProvider } from '../contexts/AuthContext'
import { renderWithProviders } from '../test/render'
import { server, API } from '../test/server'

function open(role: string) {
  localStorage.setItem('hasSession', '1')
  server.use(
    http.post(`${API}/auth/refresh`, () => HttpResponse.json({ user: { id: 'u1', email: 'x@demo.com', name: 'X', role, tenantId: 't1' }, token: 'tok' })),
    http.get(`${API}/settings/booking`, () => HttpResponse.json({ name: 'Barbería Demo', slug: 'barberia-demo', vertical: 'BARBER', labels: {} })),
  )
  return renderWithProviders(
    <AuthProvider>
      <SidebarProvider>
        <AdminSidebar />
      </SidebarProvider>
    </AuthProvider>,
  )
}

describe('Menú del panel según el rol', () => {
  it('un profesional solo ve el panel y su agenda', async () => {
    open('STAFF')
    expect(await screen.findByText('Panel de Control')).toBeInTheDocument()
    expect(screen.getByText('Citas')).toBeInTheDocument()
    for (const hidden of ['Clientes', 'Servicios', 'Notificaciones', 'Facturación', 'Configuraciones']) {
      expect(screen.queryByText(hidden)).not.toBeInTheDocument()
    }
  })

  it('el administrador ve todo menos la facturación', async () => {
    open('ADMIN')
    expect(await screen.findByText('Notificaciones')).toBeInTheDocument()
    expect(screen.getByText('Configuraciones')).toBeInTheDocument()
    expect(screen.queryByText('Facturación')).not.toBeInTheDocument()
  })
})
