import React from 'react';
import { LogoMark } from '../../brand/Logo';
import { brand } from '../../brand/brand';

/** Marco común de las páginas públicas: sin menú, pensado para el móvil. */
const PublicShell: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="min-h-screen bg-muted">
    <header className="bg-card border-b border-border">
      <div className="max-w-2xl mx-auto px-4 py-5">
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </header>
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">{children}</main>
    <footer className="max-w-2xl mx-auto px-4 pb-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
      <LogoMark size={18} /> Reservas con {brand.name}
    </footer>
  </div>
);

export default PublicShell;
