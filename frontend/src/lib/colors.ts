/** Colores de marca de un salón: de un solo #RRGGBB sale una escala que siempre se lee. */

const HEX = /^#[0-9a-fA-F]{6}$/;

export const isHexColor = (value: unknown): value is string => typeof value === 'string' && HEX.test(value);

type Rgb = [number, number, number];

const toRgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const toHex = (rgb: Rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

const mix = (a: Rgb, b: Rgb, amountOfB: number): Rgb => a.map((v, i) => v + (b[i] - v) * amountOfB) as Rgb;

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

const luminance = ([r, g, b]: Rgb) => {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
};

/** Relación de contraste WCAG entre dos colores (1 a 21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(toRgb(a)), luminance(toRgb(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Escala de acción a partir del color del salón. El paso 600 (botones y enlaces,
 * con texto blanco encima) se oscurece lo necesario para llegar a contraste 4,5:
 * un amarillo o un rosa pastel no dejan el botón ilegible.
 */
export function actionScale(base: string): Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string> {
  let c600 = toRgb(base);
  for (let i = 0; i < 40 && contrast(toHex(c600), '#FFFFFF') < 4.5; i++) c600 = mix(c600, BLACK, 0.05);
  const toward = (target: Rgb, amount: number) => toHex(mix(c600, target, amount));
  return {
    50: toward(WHITE, 0.95),
    100: toward(WHITE, 0.88),
    200: toward(WHITE, 0.75),
    300: toward(WHITE, 0.55),
    400: toward(WHITE, 0.35),
    500: toward(WHITE, 0.15),
    600: toHex(c600),
    700: toward(BLACK, 0.15),
    800: toward(BLACK, 0.3),
    900: toward(BLACK, 0.45),
  };
}
