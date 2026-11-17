import React, { useId, useState } from 'react';
import { Share, SquarePlus } from 'lucide-react';
import { promptInstall, useInstallOption, type InstallScope } from '../../lib/pwaInstall';

/** Camino para añadir la página a la pantalla de inicio del iPhone (no tiene diálogo de instalación). */
export const IosSteps: React.FC<{ id: string }> = ({ id }) => (
  <ol id={id} className="mx-auto max-w-xs space-y-2 rounded-xl bg-muted p-4 text-left text-sm text-foreground">
    <li className="flex items-start gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-card text-xs font-semibold text-muted-foreground">1</span>
      <span>
        Toca <Share aria-hidden="true" className="mx-0.5 inline h-4 w-4 -translate-y-px" />
        <b className="font-semibold"> Compartir</b>, en la barra de Safari.
      </span>
    </li>
    <li className="flex items-start gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-card text-xs font-semibold text-muted-foreground">2</span>
      <span>
        Elige <b className="font-semibold">«Añadir a pantalla de inicio»</b>.
      </span>
    </li>
    <li className="flex items-start gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-card text-xs font-semibold text-muted-foreground">3</span>
      <span>
        Toca <b className="font-semibold">Añadir</b>.
      </span>
    </li>
  </ol>
);

const buttonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 motion-reduce:transition-none motion-reduce:active:scale-100';

/**
 * Botón de instalar (solo se usa en la tarjeta de la confirmación): en Android abre el diálogo del navegador; en iPhone despliega los pasos.
 * No se pinta si no hay nada que ofrecer (ya instalada, escritorio, navegador incrustado…).
 */
export const InstallButton: React.FC<{ className?: string; scope?: InstallScope }> = ({ className, scope = 'public' }) => {
  const option = useInstallOption(scope);
  const [open, setOpen] = useState(false);
  const stepsId = useId();
  if (option.kind === 'none') return null;
  const isIos = option.kind === 'ios';
  return (
    <>
      <button
        type="button"
        className={`${buttonClass} ${className ?? ''}`}
        aria-expanded={isIos ? open : undefined}
        aria-controls={isIos ? stepsId : undefined}
        onClick={() => (isIos ? setOpen((v) => !v) : void promptInstall())}
      >
        <SquarePlus aria-hidden="true" className="h-4 w-4 text-muted-foreground" /> Añadir a mi pantalla de inicio
      </button>
      {isIos && open && <IosSteps id={stepsId} />}
    </>
  );
};

/** Tarjeta de la confirmación: el momento en que más sentido tiene guardar el acceso. */
export const InstallCard: React.FC<{ salonName: string; logoUrl?: string | null }> = ({ salonName, logoUrl }) => {
  const option = useInstallOption();
  if (option.kind === 'none') return null;
  return (
    <section aria-label="Guardar en el celular" className="space-y-3 rounded-2xl border border-border bg-card p-5 text-center">
      <div className="flex items-center justify-center gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl border border-border bg-white object-contain" />
        ) : (
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
            <SquarePlus className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 text-left">
          <h3 className="text-sm font-semibold text-foreground">Guarda {salonName} en tu celular</h3>
          <p className="text-sm text-muted-foreground">Entra con un toque desde tu pantalla de inicio, sin buscar el enlace.</p>
        </div>
      </div>
      <InstallButton className="w-full sm:w-auto" />
    </section>
  );
};
