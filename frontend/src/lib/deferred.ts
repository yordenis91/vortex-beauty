/**
 * Acciones que se ejecutan unos segundos después para poder deshacerlas (como «Deshacer» en Gmail).
 * Si la página se oculta o se cierra antes de tiempo, las pendientes se ejecutan de inmediato.
 */
const pending = new Map<string, { run: () => void; timer: ReturnType<typeof setTimeout> }>();

/** Programa `run` y devuelve la función que la cancela. Una acción con la misma clave reemplaza a la anterior. */
export function defer(key: string, run: () => void, ms: number): () => void {
  const previous = pending.get(key);
  if (previous) clearTimeout(previous.timer);
  const timer = setTimeout(() => {
    pending.delete(key);
    run();
  }, ms);
  pending.set(key, { run, timer });
  return () => {
    clearTimeout(timer);
    pending.delete(key);
  };
}

export function flushDeferred() {
  for (const [key, item] of [...pending]) {
    clearTimeout(item.timer);
    pending.delete(key);
    item.run();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushDeferred);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushDeferred();
  });
}
