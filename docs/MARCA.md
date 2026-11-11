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

## Logo y activos (v2)
Eslogan: **«Tu tiempo bajo control»**. Símbolo: un calendario con una marca de verificación cuyo
trazo largo hace de filo. Colores: tinta `#14264A` y coral `#FF6F59` (están en `brand.ts` y
`global.css`; la landing usa los mismos).

Originales en `docs/marca/` (no se modifican): `afilao-logo-v2.svg` (con nombre y eslogan, sobre
claro), `-fondo-oscuro`, `-negro`, `afilao-isotipo-v2.svg` (solo el símbolo, coral),
`afilao-app-icon-v2.svg` (1024, a sangre, símbolo dentro de la zona segura de los iconos
«maskable») y `afilao-favicon-v2.svg`.

Derivados en `frontend/public/`:
- `favicon.svg`: el favicon v2 con el símbolo más grande (a 16 y 32 px el original se perdía).
- `favicon-32.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`
  (180): salen del icono de app. Se generaron con Chromium headless a partir del SVG.
- `og-image.png` (1200×630): vista previa al compartir en WhatsApp y redes.
- `brand/isotipo.svg`: cabecera de la landing.

`LogoMark` (`src/brand/Logo.tsx`) pinta el favicon en línea con los colores de `brand.ts`.
Si cambia el logo, hay que regenerar los PNG y `og-image.png`.
