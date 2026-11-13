/**
 * Misma regla que backend/src/lib/phone.ts (el servidor es quien manda; esto solo adelanta el
 * resultado en pantalla): teléfono internacional canónico (`+5355354530`) o null.
 *  - Con «+» o «00» delante se respeta el país.
 *  - Sin prefijo y de 8 cifras o menos se antepone el código por defecto (+53, Cuba).
 *  - Sin prefijo y de 9 o más cifras se entiende que ya lleva país.
 */
export const DEFAULT_COUNTRY_CODE = '53';

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim();
  let digits = text.replace(/\D/g, '');
  if (!digits) return null;
  const plus = /^\(?\s*\+/.test(text);
  const zeros = !plus && /^\s*00/.test(text);
  if (zeros) digits = digits.slice(2);
  else if (!plus && digits.length <= 8) digits = DEFAULT_COUNTRY_CODE + digits;
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}
