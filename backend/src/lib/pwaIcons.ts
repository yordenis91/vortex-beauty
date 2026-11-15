import sharp from 'sharp';

/** Iconos para instalar la reserva de un salón en el celular: salen del logo que subió la dueña. */
export const ICON_FILES = {
  '192': { size: 192, padding: 0 },
  '512': { size: 512, padding: 0 },
  // «maskable»: Android recorta el icono (círculo, gota…); el logo se deja un poco más pequeño para que el recorte no lo corte.
  'maskable-512': { size: 512, padding: 0.1 },
  // iOS redondea las esquinas él mismo y no admite transparencia.
  'apple-180': { size: 180, padding: 0 },
} as const;

export type IconFile = keyof typeof ICON_FILES;
export const isIconFile = (value: string): value is IconFile => Object.hasOwn(ICON_FILES, value);

/** Hasta esta diferencia entre ancho y alto el logo se considera cuadrado y llena el icono (recortando lo mínimo). */
const SQUARE_TOLERANCE = 0.15;
const WHITE = { r: 255, g: 255, b: 255 };

/** Color de fondo del logo: el promedio de sus cuatro esquinas; blanco si el logo es transparente por ahí. */
async function backgroundOf(logo: Buffer): Promise<{ r: number; g: number; b: number }> {
  const { data, info } = await sharp(logo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4));
  const corners = [at(0, 0), at(info.width - 1, 0), at(0, info.height - 1), at(info.width - 1, info.height - 1)];
  if (corners.some(([, , , a]) => a < 200)) return WHITE;
  const mean = (i: number) => Math.round(corners.reduce((sum, c) => sum + c[i], 0) / corners.length);
  return { r: mean(0), g: mean(1), b: mean(2) };
}

/**
 * Icono cuadrado a partir del logo. Un logo casi cuadrado llena todo el icono; uno apaisado o alargado se
 * centra entero (sin recortarlo ni deformarlo). El fondo es el del propio logo, así no queda un marco de otro color.
 */
export async function renderIcon(logo: Buffer, file: IconFile): Promise<Buffer> {
  const { size, padding } = ICON_FILES[file];
  const inner = Math.round(size * (1 - padding * 2));
  const { data: oriented, info } = await sharp(logo).rotate().toBuffer({ resolveWithObject: true });
  const background = await backgroundOf(oriented);
  const nearSquare = Math.abs(info.width / info.height - 1) <= SQUARE_TOLERANCE;
  const resized = await sharp(oriented)
    .resize(inner, inner, { fit: nearSquare ? 'cover' : 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { ...background, alpha: 1 } } })
    .composite([{ input: resized, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Los bytes del logo guardado como data URL (PNG, JPEG o WebP), o null si el salón no tiene. */
export function logoBytes(dataUrl: string | null | undefined): Buffer | null {
  const match = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? '');
  return match ? Buffer.from(match[1], 'base64') : null;
}
