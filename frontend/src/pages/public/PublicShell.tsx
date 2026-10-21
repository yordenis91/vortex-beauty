import React from 'react';
import { LogoMark } from '../../brand/Logo';
import { brand } from '../../brand/brand';
import { actionScale, isHexColor } from '../../lib/colors';

export interface SalonBrand {
  name?: string;
  logoUrl?: string | null;
  brandColor?: string | null;
}

/** Variables CSS con la escala del color del salón: la página pública hereda su color sin tocar el resto de la app. */
function salonStyle(color?: string | null): React.CSSProperties | undefined {
  if (!isHexColor(color)) return undefined;
  const scale = actionScale(color);
  const vars: Record<string, string> = { '--primary': scale[600], '--primary-foreground': '#FFFFFF', '--salon-color': scale[600] };
  for (const [step, value] of Object.entries(scale)) vars[`--color-blue-${step}`] = value;
  return vars as React.CSSProperties;
}

/** Marco común de las páginas públicas: sin menú, pensado para el móvil. Lleva la marca del salón si la tiene. */
const PublicShell: React.FC<{ title: string; subtitle?: string; salon?: SalonBrand; children: React.ReactNode }> = ({ title, subtitle, salon, children }) => (
  <div className="min-h-screen bg-muted" style={salonStyle(salon?.brandColor)}>
    <header className="bg-card border-b border-border border-t-4" style={{ borderTopColor: salon?.brandColor ? 'var(--salon-color)' : 'var(--brand-accent)' }}>
      <div className="max-w-2xl mx-auto px-4 py-5 flex items-center gap-3">
        {salon?.logoUrl && (
          <img src={salon.logoUrl} alt={salon.name ?? title} className="h-12 w-12 rounded-xl object-contain bg-white border border-border shrink-0" />
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight text-foreground line-clamp-2 break-words">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </header>
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">{children}</main>
    <footer className="max-w-2xl mx-auto px-4 pb-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
      <LogoMark size={18} /> Reservas con {brand.name}
    </footer>
  </div>
);

export default PublicShell;
