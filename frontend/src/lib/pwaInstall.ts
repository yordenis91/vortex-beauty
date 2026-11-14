import { useSyncExternalStore } from 'react';

/**
 * Instalar la reserva de un salón en el celular de la clienta («Añadir a pantalla de inicio»).
 *
 *  - Android/Chrome avisa con `beforeinstallprompt`; se guarda para abrir el diálogo cuando la clienta pulse el botón.
 *  - iPhone/iPad no tienen ese diálogo: solo se puede explicar el camino (Compartir → Añadir a pantalla de inicio).
 *  - Instalada ya (abierta como app) o en un navegador que no puede instalar (el de Facebook/Instagram…): no se ofrece nada.
 */
export type InstallOption = { kind: 'none' } | { kind: 'prompt' } | { kind: 'ios' };

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const NONE: InstallOption = { kind: 'none' };
const PROMPT: InstallOption = { kind: 'prompt' };
const IOS: InstallOption = { kind: 'ios' };

/** Rutas de la clienta: /<salón>/reservar y /<salón>/mi-cita/<enlace>. En el panel no se toca nada. */
export const isPublicBookingPath = (path: string) => /^\/[a-z0-9-]+\/(reservar|mi-cita\/)/.test(path);

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const isStandalone = () =>
  (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** Navegadores incrustados (Facebook, Instagram…): no pueden añadir a la pantalla de inicio. */
const isInAppBrowser = () => /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|Twitter/i.test(navigator.userAgent);

/** Cuál es la opción de instalación en este dispositivo ahora mismo. */
export function currentOption(): InstallOption {
  if (installed || isStandalone() || isInAppBrowser()) return NONE;
  if (deferred) return PROMPT;
  return isIos() ? IOS : NONE;
}

let started = false;
/** Se llama una vez al arrancar: el aviso de Chrome puede llegar antes de que React pinte la página. */
export function startCapturingInstallPrompt() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    if (!isPublicBookingPath(window.location.pathname)) return; // el panel conserva el comportamiento del navegador
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    emit();
  });
}

/** Abre el diálogo de instalación del navegador (solo con la opción `prompt`). */
export async function promptInstall(): Promise<void> {
  const event = deferred;
  if (!event) return;
  deferred = null; // un aviso solo sirve una vez
  emit();
  await event.prompt();
  await event.userChoice.catch(() => undefined);
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export function useInstallOption(): InstallOption {
  return useSyncExternalStore(subscribe, currentOption, () => NONE);
}

/** Solo para pruebas. */
export function resetInstallState() {
  deferred = null;
  installed = false;
  started = false;
  listeners.clear();
}
