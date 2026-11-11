import { useId } from 'react';
import { brand } from './brand';

/**
 * Marca gráfica: un calendario con una marca de verificación cuyo trazo largo hace de filo.
 * Sobre un recuadro de tinta, sirve sola como icono. Fuente: docs/marca/afilao-favicon-v2.svg.
 */
export const LogoMark: React.FC<{ size?: number; className?: string }> = ({ size = 40, className }) => {
  const uid = useId().replace(/:/g, '');
  const box = 'M316,130 H484 C530.2,130 550,149.8 550,196 V354 C550,400.2 530.2,420 484,420 H316 C269.8,420 250,400.2 250,354 V196 C250,149.8 269.8,130 316,130 Z';
  const check = '292,290 366,358 612,92 366,298 322,258';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={brand.name} className={className}>
      <rect width="64" height="64" rx="14" fill={brand.colors.ink} />
      <g transform="translate(-26.2,-2.56) scale(0.135)">
        <defs>
          <clipPath id={`clip${uid}`}><path d={box} /></clipPath>
          <mask id={`cut${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width="800" height="800">
            <rect width="800" height="800" fill="#fff" />
            <polygon points={check} fill="#000" stroke="#000" strokeWidth="30" strokeLinejoin="round" />
          </mask>
        </defs>
        <g mask={`url(#cut${uid})`}>
          <path d={box} fill="none" stroke="#FFFFFF" strokeWidth="40" strokeLinejoin="round" />
          <rect x="240" y="120" width="320" height="72" fill="#FFFFFF" clipPath={`url(#clip${uid})`} />
        </g>
        <polygon points={check} fill={brand.colors.accent} stroke={brand.colors.accent} strokeWidth="6" strokeLinejoin="round" />
      </g>
    </svg>
  );
};

/** Icono + nombre, para cabeceras y pantalla de acceso. */
export const Logo: React.FC<{ size?: number; className?: string }> = ({ size = 40, className }) => (
  <span className={`inline-flex items-center gap-3 ${className ?? ''}`}>
    <LogoMark size={size} />
    <span className="font-extrabold tracking-tight text-gray-900" style={{ fontSize: size * 0.6 }}>
      {brand.name}
    </span>
  </span>
);
