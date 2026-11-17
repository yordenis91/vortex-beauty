import { addMonths, differenceInCalendarDays, endOfMonth, format, getISOWeek, getISOWeekYear, startOfMonth } from 'date-fns';
import toast from 'react-hot-toast';
import { api } from './api';

/** Tope del rango a imprimir: igual que en el servidor (un trimestre). */
export const MAX_PRINT_DAYS = 92;

/** Semana ISO («2026-W47») del día que se está mirando: el servidor arma la hoja de lunes a domingo. */
export const isoWeekParam = (date: Date) => `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, '0')}`;

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');

/** Primer y último día del mes de `date`, o del mes siguiente (`monthsAhead` = 1). */
export function monthRange(date: Date, monthsAhead = 0): { from: string; to: string } {
  const base = addMonths(date, monthsAhead);
  return { from: ymd(startOfMonth(base)), to: ymd(endOfMonth(base)) };
}

/** Por qué no se puede imprimir ese rango (o null si está bien). Mismas reglas que el servidor. */
export function rangeProblem(from: string, to: string): string | null {
  if (!from || !to) return 'Elige la fecha inicial y la final.';
  const days = differenceInCalendarDays(new Date(`${to}T00:00:00`), new Date(`${from}T00:00:00`)) + 1;
  if (days < 1) return 'La fecha final no puede ser anterior a la inicial.';
  if (days > MAX_PRINT_DAYS) return `Elige hasta ${MAX_PRINT_DAYS} días como máximo.`;
  return null;
}

type PrintQuery = { week: string } | { from: string; to: string };

/**
 * Pide el PDF de la agenda (con la sesión, por eso no es un simple enlace) y lo abre en otra pestaña para imprimirlo.
 * Si el navegador no deja abrir pestañas, lo descarga. Los errores se avisan aquí con un mensaje claro; devuelve si salió bien.
 */
async function printAgenda(params: PrintQuery, fileTag: string): Promise<boolean> {
  // La pestaña se abre antes de pedir el PDF: después de esperar la respuesta el navegador la bloquearía como ventana emergente.
  const tab = window.open('', '_blank');
  try {
    const res = await api.get<ArrayBuffer>('/appointments/print', { params, responseType: 'arraybuffer' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    if (tab) {
      tab.location.href = url;
    } else {
      const link = Object.assign(document.createElement('a'), { href: url, download: `agenda-${fileTag}.pdf` });
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
    return true;
  } catch {
    tab?.close();
    toast.error('No se pudo preparar la hoja. Revisa tu conexión e inténtalo otra vez.');
    return false;
  }
}

/** «Imprimir mi semana»: la semana (lunes a domingo) del día que se está viendo. */
export const printWeek = (date: Date) => {
  const week = isoWeekParam(date);
  return printAgenda({ week }, week);
};

/** Imprime las citas entre dos días (YYYY-MM-DD, inclusive). */
export const printRange = (from: string, to: string) => printAgenda({ from, to }, `${from}_${to}`);
