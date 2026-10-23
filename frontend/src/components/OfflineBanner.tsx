import React, { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { WifiOff } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useOffline } from '../lib/offline';
import { lastSync } from '../lib/persistCache';

/** Aviso fijo mientras no hay conexión: se ven los datos guardados y no se puede cambiar nada. */
const OfflineBanner: React.FC = () => {
  const offline = useOffline();
  const queryClient = useQueryClient();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (offline) {
      wasOffline.current = true;
    } else if (wasOffline.current) {
      wasOffline.current = false;
      toast.success('Conexión recuperada');
      void queryClient.invalidateQueries(); // se vuelve a pedir lo que se vio desactualizado
    }
  }, [offline, queryClient]);

  if (!offline) return null;
  const at = lastSync();
  const time = at ? new Date(at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950 dark:bg-amber-900/60 dark:text-amber-100">
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Sin conexión. {time ? `Ves los datos guardados a las ${time}.` : 'Ves los datos guardados.'} Para hacer cambios necesitas internet.
      </span>
    </div>
  );
};

export default OfflineBanner;
