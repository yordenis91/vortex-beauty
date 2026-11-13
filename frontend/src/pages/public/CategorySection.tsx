import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';

interface CategorySectionProps {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  /** Con una sola categoría no hay nada que plegar: se muestra solo el título. */
  collapsible?: boolean;
  children: React.ReactNode;
}

/**
 * Categoría de servicios con título a todo el ancho (línea fina inferior) que se pliega o despliega.
 * El contenido se anima con grid-template-rows (0fr ↔ 1fr), que no necesita medir alturas; al plegarse queda `inert`
 * para que el teclado y los lectores de pantalla no lleguen a servicios que no se ven.
 */
const CategorySection: React.FC<CategorySectionProps> = ({ title, count, open, onToggle, collapsible = true, children }) => {
  const panelId = useId();
  const expanded = open || !collapsible;

  return (
    <section>
      {/* -mx-4 compensa el padding de la página: la línea ocupa de borde a borde de la pantalla. */}
      <h3 className="-mx-4 border-b border-border">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          disabled={!collapsible}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors enabled:active:bg-card/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-full bg-blue-600" />
            <span className="truncate text-sm font-semibold uppercase tracking-wider text-foreground">{title}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
            <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-border">{count}</span>
            {collapsible && <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} />}
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div inert={!expanded} className="-mx-1 min-h-0 overflow-hidden px-1">
          <div className="space-y-2.5 pt-3 pb-1">{children}</div>
        </div>
      </div>
    </section>
  );
};

export default CategorySection;
