import { useEffect } from 'react';

interface Salon {
  slug?: string;
  name?: string;
  logoUrl?: string | null;
  brandColor?: string | null;
}

const MANIFEST_SELECTOR = 'link[rel="manifest"]';

/** Pone (o crea) una etiqueta del <head> y devuelve cómo dejarla como estaba. */
function setHead(selector: string, create: () => HTMLElement, apply: (el: HTMLElement) => void): () => void {
  let el = document.head.querySelector<HTMLElement>(selector);
  const created = !el;
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  const target = el;
  const before = target.cloneNode(true) as HTMLElement;
  apply(target);
  return () => {
    if (created) target.remove();
    else for (const { name, value } of Array.from(before.attributes)) target.setAttribute(name, value);
  };
}

const meta = (name: string) => () => Object.assign(document.createElement('meta'), { name });
const link = (rel: string) => () => Object.assign(document.createElement('link'), { rel });

/**
 * La página pública se presenta como la app del salón, no como Afilao: manifiesto, icono, nombre y color propios.
 * Así, lo que la clienta añade a su pantalla de inicio es el acceso a la reserva de ese salón.
 * Android lee el manifiesto; el iPhone lee el icono y el título de la página.
 */
export function usePublicPwa({ slug, name, logoUrl, brandColor }: Salon) {
  useEffect(() => {
    if (!slug) return;
    const undo: Array<() => void> = [];
    undo.push(setHead(MANIFEST_SELECTOR, link('manifest'), (el) => el.setAttribute('href', `/${slug}/manifest.webmanifest`)));
    if (logoUrl) undo.push(setHead('link[rel="apple-touch-icon"]', link('apple-touch-icon'), (el) => el.setAttribute('href', `/${slug}/pwa-icon-apple-180.png`)));
    if (name) {
      undo.push(setHead('meta[name="apple-mobile-web-app-title"]', meta('apple-mobile-web-app-title'), (el) => el.setAttribute('content', name)));
      const title = document.title;
      document.title = name;
      undo.push(() => void (document.title = title));
    }
    if (brandColor) undo.push(setHead('meta[name="theme-color"]', meta('theme-color'), (el) => el.setAttribute('content', brandColor)));
    return () => undo.reverse().forEach((fn) => fn());
  }, [slug, name, logoUrl, brandColor]);
}
