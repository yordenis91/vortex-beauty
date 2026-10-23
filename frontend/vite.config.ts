import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa'

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
  plugins: [
    react(),
    apiPlaceholders(),
    // PWA: se instala desde el navegador y abre sin conexión (la app se guarda en el dispositivo).
    // Los datos de la API no pasan por el service worker: los guarda React Query en IndexedDB (ver src/lib/persistCache.ts).
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Afilao',
        short_name: 'Afilao',
        description: 'Tu agenda, afilada.',
        lang: 'es',
        start_url: '/admin/dashboard',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#14213D',
        theme_color: '#14213D',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
  },
})
