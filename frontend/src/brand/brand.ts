/**
 * Marca de la plataforma: único sitio donde viven el nombre, el eslogan y los
 * colores. Para otro mercado se añade otra marca en BRANDS y se asocia a un
 * dominio; nada más del código conoce el nombre comercial.
 */
export interface Brand {
  name: string;
  tagline: string;
  /** Dominios (sin puerto) que activan esta marca. */
  domains: string[];
  colors: {
    ink: string;
    /** Acento de la marca (logo, detalles). */
    accent: string;
    /** Escala del color de acción: sustituye al azul de Tailwind en botones, enlaces y foco. */
    action: Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>;
    /** Color de la barra del navegador en el móvil. */
    themeColor: string;
  };
}

const afilao: Brand = {
  name: 'Afilao',
  tagline: 'Tu agenda, afilada',
  domains: ['afilao.app'],
  colors: {
    ink: '#14213D',
    accent: '#FF6B57',
    action: {
      50: '#FFF1EE',
      100: '#FFE0DA',
      200: '#FFC4BA',
      300: '#FF9F8F',
      400: '#FF806B',
      500: '#FF6B57',
      600: '#D63B2D',
      700: '#B52E22',
      800: '#942A21',
      900: '#7A261F',
    },
    themeColor: '#14213D',
  },
};

export const BRANDS: Brand[] = [afilao];

/** Marca por dominio; si no coincide ninguno (localhost, URLs de Easypanel) se usa la primera. */
export function brandForHost(host: string): Brand {
  const h = host.toLowerCase();
  return BRANDS.find((b) => b.domains.some((d) => h === d || h.endsWith(`.${d}`))) ?? BRANDS[0];
}

export const brand: Brand = brandForHost(typeof window === 'undefined' ? '' : window.location.hostname);

/** Aplica la marca al documento: título, color del navegador y escala de color de acción. */
export function applyBrand(b: Brand = brand): void {
  document.title = b.name;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', b.colors.themeColor);
  const root = document.documentElement.style;
  for (const [step, value] of Object.entries(b.colors.action)) root.setProperty(`--color-blue-${step}`, value);
  root.setProperty('--brand-ink', b.colors.ink);
  root.setProperty('--brand-accent', b.colors.accent);
}
