import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarSync, Copy } from 'lucide-react';
import { useActivateCalendarFeed, useCalendarFeed, useDeactivateCalendarFeed } from '../hooks/useQueries';

const secondary = 'px-4 py-2 border border-border rounded-md text-sm text-foreground bg-card hover:bg-muted disabled:opacity-50';

/** Suscribe la agenda a Google Calendar, Apple Calendar u Outlook con un enlace secreto. */
const CalendarFeedCard: React.FC<{ isStaff?: boolean }> = ({ isStaff }) => {
  const { data } = useCalendarFeed();
  const [url, setUrl] = useState<string | null>(null);
  const activate = useActivateCalendarFeed({ onSuccess: (r) => setUrl((r as { url: string }).url) });
  const deactivate = useDeactivateCalendarFeed({
    onSuccess: () => {
      setUrl(null);
      toast.success('Enlace desactivado');
    },
  });
  if (!data) return null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Enlace copiado');
    } catch {
      toast.error('No se pudo copiar. Selecciónalo y cópialo a mano.');
    }
  };

  return (
    <section className="bg-card rounded-lg shadow-md p-6">
      <h2 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
        <CalendarSync className="h-5 w-5" /> Ver mis citas en mi calendario
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Suscribe {isStaff ? 'tus citas' : 'la agenda del salón'} en Google Calendar, Apple Calendar u Outlook. Se actualiza sola: las citas nuevas, los cambios y las cancelaciones aparecen
        en tu teléfono sin abrir esta página.
      </p>

      {url ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Copia este enlace y pégalo en tu calendario. Solo se muestra ahora.</p>
          <code className="block rounded-md bg-muted p-3 text-xs break-all select-all" data-testid="enlace-calendario">{url}</code>
          <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700">
            <Copy className="h-4 w-4" /> Copiar enlace
          </button>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li><b>Google Calendar</b> (en el navegador): Otros calendarios → «+» → Desde URL → pega el enlace.</li>
            <li><b>iPhone:</b> Ajustes → Calendario → Cuentas → Añadir cuenta → Otra → Añadir calendario suscrito.</li>
            <li><b>Outlook:</b> Agregar calendario → Suscribirse desde la web.</li>
          </ul>
          <p className="text-xs text-muted-foreground">Quien tenga este enlace puede ver tus citas. Si se filtra, genera uno nuevo y el anterior deja de funcionar.</p>
        </div>
      ) : data.active ? (
        <div className="space-y-3">
          <p className="text-sm text-green-700">✓ Tu calendario está activo.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondary} disabled={activate.isPending} onClick={() => activate.mutate(undefined)}>
              Generar un enlace nuevo
            </button>
            <button type="button" className={`${secondary} text-red-600`} disabled={deactivate.isPending} onClick={() => deactivate.mutate(undefined)}>
              Desactivar
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Por seguridad el enlace no se vuelve a mostrar. Si lo perdiste, genera uno nuevo (el anterior dejará de funcionar).</p>
        </div>
      ) : (
        <button type="button" disabled={activate.isPending} onClick={() => activate.mutate(undefined)} className="px-5 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
          {activate.isPending ? 'Creando…' : 'Activar mi calendario'}
        </button>
      )}
    </section>
  );
};

export default CalendarFeedCard;
