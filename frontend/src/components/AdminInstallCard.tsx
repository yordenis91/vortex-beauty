import React, { useState } from 'react';
import { SquarePlus, X } from 'lucide-react';
import { InstallButton } from '../pages/public/InstallApp';
import { useInstallOption } from '../lib/pwaInstall';

const dismissKey = (slug: string) => `afilao:install-cta-dismissed:${slug}`;

function wasDismissed(slug: string): boolean {
  try {
    return localStorage.getItem(dismissKey(slug)) === '1';
  } catch {
    return false;
  }
}

function rememberDismissed(slug: string) {
  try {
    localStorage.setItem(dismissKey(slug), '1');
  } catch {
    // sin almacenamiento: el aviso volverá a salir, no es crítico
  }
}

/**
 * Invitación del panel a instalar Afilao en el celular. Solo sale si este dispositivo puede instalarla
 * (Android con el aviso de Chrome, o iPhone con los pasos de Safari) y se va para siempre al cerrarla.
 * La clave lleva el salón, para que dos salones en el mismo celular no se silencien entre sí.
 */
const AdminInstallCard: React.FC<{ slug?: string }> = ({ slug }) => {
  const option = useInstallOption('app');
  const [hidden, setHidden] = useState(false);
  if (!slug || option.kind === 'none' || hidden || wasDismissed(slug)) return null;
  return (
    <section aria-label="Instalar Afilao" className="relative rounded-lg border border-border bg-card p-4 pr-12 shadow sm:p-5 sm:pr-14">
      <button
        type="button"
        aria-label="No volver a mostrar este aviso"
        onClick={() => {
          rememberDismissed(slug);
          setHidden(true);
        }}
        className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
          <SquarePlus className="h-5 w-5" />
        </span>
        <div className="min-w-0 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Instala tu Afilao en el celular</h2>
            <p className="text-sm text-muted-foreground">Ábrelo con un toque desde tu pantalla de inicio y mira tu agenda sin buscar el enlace.</p>
          </div>
          <InstallButton scope="app" />
        </div>
      </div>
    </section>
  );
};

export default AdminInstallCard;
