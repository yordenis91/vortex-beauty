import React, { useEffect, useState } from 'react';
import { WifiOff, CloudOff } from 'lucide-react';
import { isOffline } from '../../lib/offline';
import type { ErrorKind } from '../../lib/publicConnectivity';

export const Spinner: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
  </div>
);

/** Carga de una página entera: si tarda, lo dice, para que no parezca que se colgó. */
export const LoadingPage: React.FC<{ retrying?: boolean }> = ({ retrying = false }) => {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), 6000);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div role="status" aria-live="polite">
      <Spinner />
      {(slow || retrying) && (
        <p className="pb-8 text-center text-sm text-muted-foreground">
          {retrying ? 'Reintentando… tu conexión está lenta.' : 'Conectando… tu conexión está lenta. Un momento.'}
        </p>
      )}
    </div>
  );
};

/** Pantalla de «no pudimos cargar» por conexión o servidor (nunca por un enlace inexistente). */
export const ConnectionProblem: React.FC<{ kind: Exclude<ErrorKind, 'not-found'>; onRetry: () => void; retrying?: boolean }> = ({ kind, onRetry, retrying = false }) => {
  const server = kind === 'server';
  const offline = !server && isOffline();
  const Icon = server ? CloudOff : WifiOff;
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
      <Icon className="h-10 w-10 text-muted-foreground" aria-hidden />
      <h2 className="text-lg font-semibold text-foreground">{server ? 'Estamos con problemas' : offline ? 'Sin conexión' : 'No pudimos conectar'}</h2>
      <p className="max-w-xs text-sm text-muted-foreground">
        {server
          ? 'No es tu conexión: el servicio no responde ahora mismo. Inténtalo de nuevo en un momento.'
          : offline
            ? 'Tu teléfono no tiene internet. Cuando vuelva la señal, se cargará solo.'
            : 'Tu conexión parece lenta o sin señal. No has perdido nada: reintenta cuando quieras.'}
      </p>
      <button type="button" onClick={onRetry} disabled={retrying} className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
        {retrying ? 'Reintentando…' : 'Reintentar'}
      </button>
    </div>
  );
};

/** Aviso sobre datos guardados que no se pudieron actualizar. */
export const StaleNotice: React.FC<{ children: React.ReactNode; onRetry: () => void; retrying?: boolean }> = ({ children, onRetry, retrying = false }) => (
  <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
    <span className="flex items-center gap-2">
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      {children}
    </span>
    <button type="button" onClick={onRetry} disabled={retrying} className="rounded-lg border border-amber-300 px-3 py-1.5 font-medium hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:hover:bg-amber-900/50">
      {retrying ? 'Reintentando…' : 'Reintentar'}
    </button>
  </div>
);
