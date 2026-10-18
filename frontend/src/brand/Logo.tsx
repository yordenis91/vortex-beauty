import { brand } from './brand';

/** Marca gráfica: una navaja abierta sobre el fondo de tinta. Sirve sola como icono. */
export const LogoMark: React.FC<{ size?: number; className?: string }> = ({ size = 40, className }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={brand.name} className={className}>
    <rect width="64" height="64" rx="16" fill={brand.colors.ink} />
    <path d="M18 44 42 14c1.2-1.5 3.5-.4 3.2 1.5L40 46c-.2 1.2-1.3 2-2.5 1.7L19.6 46.6c-1.6-.4-2.5-2-1.6-2.6Z" fill={brand.colors.accent} />
    <circle cx="23" cy="43" r="3.2" fill={brand.colors.ink} />
  </svg>
);

/** Icono + nombre, para cabeceras y pantalla de acceso. */
export const Logo: React.FC<{ size?: number; className?: string }> = ({ size = 40, className }) => (
  <span className={`inline-flex items-center gap-3 ${className ?? ''}`}>
    <LogoMark size={size} />
    <span className="font-extrabold tracking-tight text-gray-900" style={{ fontSize: size * 0.6 }}>
      {brand.name.toLowerCase()}
    </span>
  </span>
);
