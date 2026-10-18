/**
 * Reduce una imagen en el navegador antes de subirla: lado máximo 1024 px y JPEG
 * al 82 %. Una foto de móvil de 4 MB queda en ~150 KB. Devuelve un data URL.
 */
export async function compressImage(file: File, maxSide = 1024, quality = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen');

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo procesar la imagen');
  // Fondo blanco: los PNG con transparencia no se vuelven negros al pasar a JPEG
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Logo de un negocio: lado máximo 256 px y PNG (conserva la transparencia).
 * Se reduce más si hace falta para que quepa en el límite del servidor (100 KB).
 */
export async function compressLogo(file: File, maxBytes = 90_000): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen');
  const bitmap = await createImageBitmap(file);
  try {
    for (const side of [256, 192, 128]) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo procesar la imagen');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL('image/png');
      if (Math.floor((url.length * 3) / 4) <= maxBytes) return url;
    }
  } finally {
    bitmap.close();
  }
  throw new Error('El logo es demasiado complejo. Usa una imagen más simple.');
}
