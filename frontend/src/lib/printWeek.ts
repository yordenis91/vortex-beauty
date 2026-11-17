import { getISOWeek, getISOWeekYear } from 'date-fns';
import toast from 'react-hot-toast';
import { api } from './api';

/** Semana ISO («2026-W47») del día que se está mirando: el servidor arma la hoja de lunes a domingo. */
export const isoWeekParam = (date: Date) => `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, '0')}`;

/**
 * «Imprimir mi semana»: pide el PDF de la semana de `date` (con la sesión, por eso no es un simple enlace) y lo abre
 * en otra pestaña para imprimirlo. Si el navegador no deja abrir pestañas, lo descarga.
 * Los errores se avisan aquí con un mensaje claro; devuelve si salió bien.
 */
export async function printWeek(date: Date): Promise<boolean> {
  const week = isoWeekParam(date);
  // La pestaña se abre antes de pedir el PDF: después de esperar la respuesta el navegador la bloquearía como ventana emergente.
  const tab = window.open('', '_blank');
  try {
    const res = await api.get<ArrayBuffer>('/appointments/print', { params: { week }, responseType: 'arraybuffer' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    if (tab) {
      tab.location.href = url;
    } else {
      const link = Object.assign(document.createElement('a'), { href: url, download: `agenda-${week}.pdf` });
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
    return true;
  } catch {
    tab?.close();
    toast.error('No se pudo preparar la hoja de la semana. Revisa tu conexión e inténtalo otra vez.');
    return false;
  }
}
