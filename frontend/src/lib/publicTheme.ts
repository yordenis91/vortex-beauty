import { useLayoutEffect } from 'react';

/** Marca en <html> mientras una página pública manda sobre el tema; `ThemeProvider` la respeta. */
export const PUBLIC_THEME_FLAG = 'publicTheme';

/**
 * Las páginas públicas (reserva y «mi cita») siguen el modo claro/oscuro del sistema de quien las abre,
 * y reaccionan en vivo si cambia. El panel del salón no: allí manda el interruptor de tema de la cuenta.
 */
export function usePublicTheme() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    root.dataset[PUBLIC_THEME_FLAG] = '1';
    const apply = () => root.classList.toggle('dark', !!query?.matches);
    apply();
    query?.addEventListener?.('change', apply);
    return () => {
      query?.removeEventListener?.('change', apply);
      delete root.dataset[PUBLIC_THEME_FLAG];
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem('theme');
      } catch {
        /* sin almacenamiento: tema claro */
      }
      root.classList.toggle('dark', stored === 'dark');
    };
  }, []);
}
