/** Código de país por defecto (Cuba): se antepone a los números locales que no lo traen. */
export const DEFAULT_COUNTRY_CODE = '53';

/**
 * Teléfono en formato internacional canónico (`+5355354530`) o null si no es un número válido.
 *
 *  - Con `+` o `00` delante se respeta el país indicado: «(+53) 5535 4530», «0053 55354530».
 *  - Sin prefijo y de 8 cifras o menos (número local) se le antepone el código por defecto:
 *    «5535 4530» → +5355354530.
 *  - Sin prefijo y de 9 o más cifras se entiende que ya lleva código de país: «53 5535 4530»,
 *    «34 612 345 678».
 */
export function normalizePhone(raw: string | null | undefined, defaultCountry: string = DEFAULT_COUNTRY_CODE): string | null {
  if (!raw) return null;
  const text = raw.trim();
  let digits = text.replace(/\D/g, '');
  if (!digits) return null;

  const international = /^\(?\s*\+/.test(text) || digits.startsWith('00') && /^\s*00/.test(text);
  if (international) {
    if (/^\s*00/.test(text) && !/^\(?\s*\+/.test(text)) digits = digits.slice(2);
  } else if (digits.length <= 8) {
    digits = defaultCountry + digits;
  }
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

/** Clave para reconocer al mismo cliente aunque escriba el teléfono distinto: solo dígitos, con país. */
export function phoneKey(raw: string | null | undefined): string | null {
  return normalizePhone(raw)?.slice(1) ?? null;
}
