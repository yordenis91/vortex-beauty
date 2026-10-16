import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

// Configuración aparte de vite.config.ts: Vitest trae su propia versión de Vite,
// así que no se reutiliza el plugin de React (esbuild compila el JSX).
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
  },
})
