/** Teléfono normalizado: solo dígitos. Sirve para reconocer al mismo cliente aunque lo escriba distinto. */
export function phoneKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 15 ? digits : null;
}
