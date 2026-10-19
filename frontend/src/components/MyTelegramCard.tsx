import React from 'react';
import toast from 'react-hot-toast';
import { Bell } from 'lucide-react';
import { useMyTelegramLink, useUnlinkMyTelegram } from '../hooks/useQueries';

/** Avisos por Telegram de las citas propias: solo aparece para quien tiene ficha de profesional. */
const MyTelegramCard: React.FC = () => {
  const { data } = useMyTelegramLink();
  const unlink = useUnlinkMyTelegram({ onSuccess: () => toast.success('Telegram desvinculado') });
  if (!data?.hasProfessional) return null;

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success('Copiado');
  };

  return (
    <section className="bg-card rounded-lg shadow-md p-6">
      <h2 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
        <Bell className="h-5 w-5" /> Avisos de mis citas por Telegram
      </h2>

      {data.linked ? (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            ✅ Vinculado. Te escribimos aquí cuando alguien reserva contigo o cancela. Solo ves lo tuyo.
          </p>
          <button
            type="button"
            onClick={() => unlink.mutate(undefined)}
            disabled={unlink.isPending}
            className="px-4 py-2 border border-border rounded-md text-sm text-foreground bg-card hover:bg-muted disabled:opacity-50"
          >
            {unlink.isPending ? 'Desvinculando…' : 'Desvincular Telegram'}
          </button>
        </>
      ) : data.botUsername && data.code ? (
        <>
          <p className="text-sm text-muted-foreground mb-4">Recibe aquí solo los avisos de tus citas. Son dos pasos:</p>
          <ol className="text-sm text-foreground space-y-3 list-decimal list-inside">
            <li>
              Abre el bot del salón:{' '}
              <a href={`https://t.me/${data.botUsername}`} target="_blank" rel="noreferrer" className="text-blue-600 font-medium">
                @{data.botUsername}
              </a>
            </li>
            <li>
              Envíale este mensaje:{' '}
              <code className="px-2 py-1 bg-muted rounded font-mono">/vincular {data.code}</code>{' '}
              <button type="button" onClick={() => void copy(`/vincular ${data.code}`)} className="text-blue-600 text-xs underline">
                Copiar
              </button>
            </li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">El código sirve una sola vez. Esta página se actualiza sola cuando termines.</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">El salón todavía no activó el bot de Telegram. Pídele al dueño que lo conecte en Configuraciones.</p>
      )}
    </section>
  );
};

export default MyTelegramCard;
