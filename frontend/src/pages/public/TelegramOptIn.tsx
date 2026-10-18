import React from 'react';
import { Send, Check } from 'lucide-react';
import type { TelegramOptIn as TelegramInfo } from '../../lib/publicApi';

/**
 * Invita al cliente a recibir sus avisos por el bot de Telegram del salón. El
 * enlace lleva el token secreto de su cita, así que no hay que escribir nada.
 */
const TelegramOptIn: React.FC<{ telegram: TelegramInfo | null | undefined }> = ({ telegram }) => {
  if (!telegram) return null;

  if (telegram.linked) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-green-700">
        <Check className="h-4 w-4" /> Recibirás tus avisos por Telegram
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted p-4 space-y-2 text-left">
      <p className="text-sm font-medium text-foreground">¿Prefieres recibir los avisos por Telegram?</p>
      <p className="text-xs text-muted-foreground">Te confirmamos y te recordamos aquí, sin correo. Abre el bot y pulsa «Iniciar».</p>
      <a
        href={telegram.deepLink}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-white bg-sky-600 hover:bg-sky-700 text-sm font-medium"
      >
        <Send className="h-4 w-4" /> Recibir avisos por Telegram
      </a>
    </div>
  );
};

export default TelegramOptIn;
