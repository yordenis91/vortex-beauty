import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.tsx'
import { ThemeProvider } from '@/components/ui/theme-provider'
import { applyBrand } from './brand/brand'
import { queryClient } from './lib/queryClient'
import { clearPersistedCache, trackLastSync } from './lib/persistCache'
import { sessionMayBeAlive } from './lib/session'

applyBrand()
trackLastSync(queryClient)
// Si la sesión terminó de verdad (no solo falta la red), los datos guardados en el dispositivo se borran.
window.addEventListener('auth-error', () => {
  if (!sessionMayBeAlive()) {
    queryClient.clear()
    void clearPersistedCache()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
