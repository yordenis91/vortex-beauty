import sharp from 'sharp';

/** Iconos para instalar la reserva de un salón en el celular: salen del logo que subió la dueña. */
export const ICON_FILES = {
  '192': { size: 192, padding: 0.1 },
  '512': { size: 512, padding: 0.1 },
  // «maskable»: Android recorta el icono (círculo, gota…); lo importante debe quedar en el 60 % central.
  'maskable-512': { size: 512, padding: 0.22 },
  // iOS redondea las esquinas él mismo y no admite transparencia.
  'apple-180': { size: 180, padding: 0.1 },
} as const;

export type IconFile = keyof typeof ICON_FILES;
export const isIconFile = (value: string): value is IconFile => Object.hasOwn(ICON_FILES, value);

const BACKGROUND = { r: 255, g: 255, b: 255, alpha: 1 };

/** Logo centrado, sin deformarlo, sobre un cuadrado blanco del tamaño pedido. */
export async function renderIcon(logo: Buffer, file: IconFile): Promise<Buffer> {
  const { size, padding } = ICON_FILES[file];
  const inner = Math.round(size * (1 - padding * 2));
  const resized = await sharp(logo).rotate().resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: resized, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Los bytes del logo guardado como data URL (PNG, JPEG o WebP), o null si el salón no tiene. */
export function logoBytes(dataUrl: string | null | undefined): Buffer | null {
  const match = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? '');
  return match ? Buffer.from(match[1], 'base64') : null;
}
