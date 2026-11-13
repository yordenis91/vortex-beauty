import React, { useEffect, useState } from 'react';
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

// Histéresis: se compacta al bajar de 48 px y solo se expande al volver casi arriba (8 px). Como compactar
// acorta la página, un único umbral haría parpadear la cabecera en páginas cortas.
const COMPACT_AFTER = 48;
const EXPAND_BEFORE = 8;

/** Marco común de las páginas públicas: sin menú, pensado para el móvil. Lleva la marca del salón si la tiene. */
const PublicShell: React.FC<{ title: string; subtitle?: string; salon?: SalonBrand; children: React.ReactNode }> = ({ title, subtitle, salon, children }) => {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact((was) => (was ? window.scrollY > EXPAND_BEFORE : window.scrollY > COMPACT_AFTER));
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-muted" style={salonStyle(salon?.brandColor)}>
      {/* Cabecera fija: el nombre y el logo del negocio se quedan a la vista mientras se recorre la lista; al bajar, se compacta. */}
      <header
        data-compact={compact}
        className={`sticky top-0 z-30 bg-card border-b border-border border-t-4 transition-shadow duration-200 ${compact ? 'shadow-sm' : ''}`}
        style={{ borderTopColor: salon?.brandColor ? 'var(--salon-color)' : 'var(--brand-accent)' }}
      >
        <div className={`max-w-2xl mx-auto px-4 flex items-center gap-3 transition-[padding] duration-200 ${compact ? 'py-2' : 'py-5'}`}>
          {salon?.logoUrl && (
            <img
              src={salon.logoUrl}
              alt={salon.name ?? title}
              className={`rounded-xl object-contain bg-white border border-border shrink-0 transition-[width,height] duration-200 ${compact ? 'h-9 w-9' : 'h-12 w-12'}`}
            />
          )}
          <div className="min-w-0">
            <h1 className={`font-bold leading-tight text-foreground line-clamp-2 break-words transition-[font-size] duration-200 ${compact ? 'text-base' : 'text-xl'}`}>{title}</h1>
            {subtitle && (
              <p className={`text-sm text-muted-foreground overflow-hidden transition-[max-height,opacity,margin] duration-200 ${compact ? 'max-h-0 opacity-0 mt-0' : 'max-h-6 mt-0.5'}`}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">{children}</main>
      <footer className="max-w-2xl mx-auto px-4 pb-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <LogoMark size={18} /> Reservas con {brand.name}
      </footer>
    </div>
  );
};

export default PublicShell;
