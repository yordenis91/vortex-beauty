import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Misma URL por defecto que src/lib/*.ts: el HTML la necesita antes de que cargue el JS.
const DEFAULT_API = 'https://deploy-vortex-backend.wgteoi.easypanel.host/api'

function apiPlaceholders(): Plugin {
  let api = DEFAULT_API
  return {
    name: 'api-placeholders',
    configResolved(config) {
      api = loadEnv(config.mode, config.root, 'VITE_').VITE_API_BASE_URL || DEFAULT_API
    },
    transformIndexHtml: (html) => html.replaceAll('__API_BASE_URL__', api).replaceAll('__API_ORIGIN__', new URL(api).origin),
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiPlaceholders()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
  },
})
