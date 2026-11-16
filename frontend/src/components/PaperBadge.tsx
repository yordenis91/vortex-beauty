import React from 'react';

/** Marca informativa de las citas que se anotaron primero en el cuaderno (ver lib/paper.ts). */
const PaperBadge: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span role="img" aria-label="Anotada desde papel" title="Anotada desde papel" className={`shrink-0 text-[0.9em] leading-none ${className}`}>
    📝
  </span>
);

export default PaperBadge;
