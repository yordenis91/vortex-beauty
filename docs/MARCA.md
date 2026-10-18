# Marca

La marca (nombre, eslogan, colores) vive solo en `frontend/src/brand/brand.ts`.
`applyBrand()` se ejecuta al arrancar: pone el título, el color del navegador y
sustituye la escala `blue-*` de Tailwind por la escala de acción de la marca
(los botones, enlaces y el foco usan `blue-*`). Los colores de los componentes
shadcn (`--primary`) están en `styles/global.css`.

## Añadir una marca para otro mercado
1. Añade un objeto `Brand` a `BRANDS` con sus `domains`, nombre y colores.
2. Apunta el dominio al mismo servidor. `brandForHost` elige la marca por el
   dominio; sin coincidencia (localhost, URLs de Easypanel) usa la primera.
3. Actualiza `--primary` en `global.css` si el color de acción cambia.

El logo (`brand/Logo.tsx`) y `public/favicon.svg` son de la marca actual.
Los identificadores internos (servicios, prefijo de respaldos, roles de BD)
conservan el nombre `vortex`: no son visibles para el cliente.

## Marca blanca por salón
Cada salón puede subir su logo y elegir un color en Ajustes → «Tu marca». Se
guardan en `TenantSettings.logoUrl` (PNG/JPG/WebP en data URL, máx. 100 KB; el
navegador lo reduce a 256 px; nunca SVG) y `brandColor` (`#RRGGBB`). El catálogo
público (`GET /api/public/booking/:slug`) y la vista «mi cita» los devuelven, y
`PublicShell` los aplica solo a esas páginas: el panel y el login siguen con la
marca de la plataforma.

El color del salón se convierte en una escala (`lib/colors.ts`) cuyo paso 600
se oscurece hasta contraste 4,5 con texto blanco, así cualquier color elegido
deja los botones legibles. El pie «Reservas con Afilao» se mantiene.
