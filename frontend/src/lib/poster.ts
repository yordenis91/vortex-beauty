import { contrast, isHexColor } from './colors';

export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT = 1500;

const escapeXml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface PosterOptions {
  /** SVG del código QR tal como lo genera la librería. */
  qrSvg: string;
  salonName: string;
  url: string;
  /** Logo del salón (data URL) y su color; sin ellos se usa la marca de la plataforma. */
  logoUrl?: string | null;
  brandColor?: string | null;
  /** Marca de la plataforma: color de respaldo y pie del cartel. */
  fallbackColor: string;
  platformName: string;
}

/**
 * Cartel de reservas como una sola imagen SVG (1080 × 1500): banda con el color
 * y el logo del salón, el QR y el enlace. Sirve para imprimir y para compartir como imagen.
 */
export function posterSvg(o: PosterOptions): string {
  const color = isHexColor(o.brandColor) ? o.brandColor : o.fallbackColor;
  const onColor = contrast(color, '#FFFFFF') >= contrast(color, '#111111') ? '#FFFFFF' : '#111111';
  const qr = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(o.qrSvg)}`;
  const name = o.salonName.trim();
  const nameSize = name.length > 26 ? 52 : name.length > 16 ? 64 : 80;
  const urlSize = o.url.length > 38 ? 30 : 38;

  const logo = o.logoUrl
    ? `<rect x="400" y="60" width="280" height="200" rx="28" fill="#FFFFFF"/>
  <image href="${escapeXml(o.logoUrl)}" x="415" y="72" width="250" height="176" preserveAspectRatio="xMidYMid meet"/>`
    : '';
  // Sin logo, el nombre ocupa la banda.
  const band = o.logoUrl
    ? logo
    : `<text x="540" y="190" text-anchor="middle" font-size="${nameSize}" font-weight="700" fill="${onColor}">${escapeXml(name)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}" font-family="system-ui, 'Segoe UI', Helvetica, Arial, sans-serif">
  <rect width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" fill="#FFFFFF"/>
  <rect width="${POSTER_WIDTH}" height="320" fill="${color}"/>
  ${band}
  ${o.logoUrl ? `<text x="540" y="440" text-anchor="middle" font-size="${nameSize}" font-weight="700" fill="#111111">${escapeXml(name)}</text>` : ''}
  <text x="540" y="${o.logoUrl ? 520 : 440}" text-anchor="middle" font-size="46" fill="#333333">Reserva tu cita escaneando el código</text>
  <rect x="190" y="590" width="700" height="700" rx="24" fill="#FFFFFF" stroke="${color}" stroke-width="8"/>
  <image href="${qr}" x="220" y="620" width="640" height="640"/>
  <text x="540" y="1360" text-anchor="middle" font-size="34" fill="#555555">Abre la cámara de tu móvil y apunta al código</text>
  <text x="540" y="1415" text-anchor="middle" font-size="${urlSize}" font-weight="600" fill="#111111">${escapeXml(o.url)}</text>
  <text x="540" y="1470" text-anchor="middle" font-size="24" fill="#888888">Reservas con ${escapeXml(o.platformName)}</text>
</svg>`;
}
