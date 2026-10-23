import { useSyncExternalStore } from 'react';

/** Mensaje cuando una acción que escribe datos se intenta sin conexión. */
export const OFFLINE_MESSAGE = 'Sin conexión: esta acción necesita internet. Inténtalo cuando vuelva la conexión.';

export class OfflineError extends Error {
  constructor() {
    super(OFFLINE_MESSAGE);
    this.name = 'OfflineError';
  }
}

export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

const subscribe = (callback: () => void) => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};

/** true mientras el navegador no tenga conexión. */
export const useOffline = () => useSyncExternalStore(subscribe, isOffline, () => false);
