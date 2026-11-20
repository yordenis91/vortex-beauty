import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback'?: () => void }) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}

/**
 * Carga el widget anti-bots de Cloudflare Turnstile cuando el salón tiene clave configurada.
 * `active`: el contenedor del widget está en pantalla (solo en el último paso); sin esto el widget nunca llegaría a dibujarse.
 */
export function useTurnstile(siteKey: string | null | undefined, active = true) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState('');
  const widgetRef = useRef<string>(undefined);

  useEffect(() => {
    if (!siteKey || !active || !containerRef.current) return;
    const container = containerRef.current;
    let widgetId: string | undefined;

    const render = () => {
      if (window.turnstile && container && !widgetId) {
        widgetId = window.turnstile.render(container, { sitekey: siteKey, callback: setToken, 'expired-callback': () => setToken('') });
        widgetRef.current = widgetId;
      }
    };

    if (window.turnstile) render();
    else {
      let script = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.dataset.turnstile = '1';
        document.head.appendChild(script);
      }
      script.addEventListener('load', render);
    }

    return () => {
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      widgetRef.current = undefined;
    };
  }, [siteKey, active]);

  /** Cada verificación vale para un solo envío: tras un intento que falló, se pide una nueva. */
  const reset = () => {
    setToken('');
    if (widgetRef.current && window.turnstile) window.turnstile.reset(widgetRef.current);
  };

  return { containerRef, token, required: !!siteKey, reset };
}
