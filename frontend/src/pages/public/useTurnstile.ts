import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback'?: () => void }) => string;
      remove: (id: string) => void;
    };
  }
}

/** Carga el widget anti-bots de Cloudflare Turnstile cuando el salón tiene clave configurada. */
export function useTurnstile(siteKey: string | null | undefined) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    const container = containerRef.current;
    let widgetId: string | undefined;

    const render = () => {
      if (window.turnstile && container && !widgetId) {
        widgetId = window.turnstile.render(container, { sitekey: siteKey, callback: setToken, 'expired-callback': () => setToken('') });
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
    };
  }, [siteKey]);

  return { containerRef, token, required: !!siteKey };
}
