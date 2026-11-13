/**
 * Días «de calendario» (`yyyy-MM-dd`, como los cierres del salón): se muestran tal cual, sin pasar por
 * `new Date(...)`. Esa cadena se interpreta como medianoche UTC y en Cuba (UTC-5) se vería el día anterior.
 */
export function formatYmd(ymd: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (ymd ?? '');
}
