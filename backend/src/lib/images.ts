import { z } from 'zod';

/**
 * Imágenes de perfil y galería. Hoy se guardan como data URL dentro de la base
 * (sin almacenamiento de objetos), así que se limitan por tipo y tamaño: el
 * navegador las reduce antes de subirlas (frontend/src/lib/image.ts).
 */
const MAX_IMAGE_BYTES = 1_500_000; // 1,5 MB ya decodificada
const DATA_URL = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/;

export const imageSchema = z
  .string()
  .max(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 100, 'La imagen es demasiado grande (máx. 1,5 MB)')
  .refine(
    (value) => {
      if (/^https:\/\/\S{1,2000}$/.test(value)) return true;
      const match = DATA_URL.exec(value);
      if (!match) return false;
      const bytes = Math.floor((match[2].length * 3) / 4);
      return bytes <= MAX_IMAGE_BYTES;
    },
    'Formato de imagen no válido (usa PNG, JPG o WebP de hasta 1,5 MB)'
  );

/**
 * Logo del salón: se sirve dentro del catálogo público en cada visita, así que
 * es mucho más pequeño que una foto. Solo data URL (nunca SVG, que puede llevar
 * scripts); el navegador lo reduce a ~256 px antes de subirlo.
 */
const MAX_LOGO_BYTES = 100_000;
export const logoSchema = z
  .string()
  .max(Math.ceil((MAX_LOGO_BYTES * 4) / 3) + 100, 'El logo es demasiado grande (máx. 100 KB)')
  .refine((value) => {
    const match = DATA_URL.exec(value);
    return !!match && Math.floor((match[2].length * 3) / 4) <= MAX_LOGO_BYTES;
  }, 'Formato de logo no válido (usa PNG, JPG o WebP de hasta 100 KB)');

export const brandColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'El color debe ser #RRGGBB');
