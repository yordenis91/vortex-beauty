import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

/** Renderiza con router en memoria y un QueryClient sin reintentos (los tests no esperan backoff). */
export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Renderiza una pantalla en su ruta real (con parámetros) y devuelve también un destino para comprobar redirecciones. */
export function renderPage(element: ReactElement, { path, route, extraRoutes }: { path: string; route: string; extraRoutes?: Record<string, ReactElement> }) {
  return renderWithProviders(
    <Routes>
      <Route path={path} element={element} />
      {Object.entries(extraRoutes ?? {}).map(([p, el]) => (
        <Route key={p} path={p} element={el} />
      ))}
    </Routes>,
    { route },
  )
}
