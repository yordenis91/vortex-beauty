import toast from 'react-hot-toast';

/** Copia un texto al portapapeles y avisa. Si el navegador no lo permite, prueba la vía antigua y, si no, muestra el texto. */
export async function copyText(text: string, okMessage = 'Copiado'): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(okMessage);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      if (ok) {
        toast.success(okMessage);
        return true;
      }
    } catch {
      // se cae al aviso con el texto
    }
    toast.error(`No se pudo copiar. Cópialo a mano: ${text}`, { duration: 10000 });
    return false;
  }
}
