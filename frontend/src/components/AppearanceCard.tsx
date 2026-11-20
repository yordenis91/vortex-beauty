import React from 'react';
import { Moon, SunMedium } from 'lucide-react';
import { useTheme } from '@/components/ui/theme-provider';

const OPTIONS = [
  { value: 'light', label: 'Claro', icon: SunMedium },
  { value: 'dark', label: 'Oscuro', icon: Moon },
] as const;

/** Tema de color del panel. Se recuerda en este dispositivo. */
const AppearanceCard: React.FC = () => {
  const { theme, setTheme } = useTheme();
  return (
    <section className="bg-card rounded-lg shadow-md p-6">
      <h2 className="text-lg font-semibold text-foreground mb-1">Apariencia</h2>
      <p className="text-sm text-muted-foreground mb-4">Elige cómo se ve el panel. Se guarda en este dispositivo.</p>
      <div role="radiogroup" aria-label="Tema del panel" className="inline-flex rounded-lg border border-border p-1">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(value)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default AppearanceCard;
