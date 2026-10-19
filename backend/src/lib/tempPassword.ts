import crypto from 'node:crypto';

/** Contraseña temporal legible (evita caracteres ambiguos como 0/O, 1/l/I). */
export function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(12))
    .map((byte) => alphabet[byte % alphabet.length])
    .join('');
}
