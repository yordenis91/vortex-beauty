import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useBookingSettings, useUpdateBookingSettings } from '../hooks/useQueries';
import { compressLogo } from '../lib/image';
import { actionScale, isHexColor } from '../lib/colors';

const SWATCHES = ['#1F8A70', '#2F6FED', '#7C3AED', '#D63B2D', '#E07A1F', '#0F766E', '#BE185D', '#14213D'];

const SalonBrandForm: React.FC<{ name: string; initialLogo: string | null; initialColor: string | null }> = ({ name, initialLogo, initialColor }) => {
  const [logo, setLogo] = useState<string | null>(initialLogo);
  const [color, setColor] = useState<string | null>(initialColor);
  const file = useRef<HTMLInputElement>(null);
  const update = useUpdateBookingSettings({ onSuccess: () => toast.success('Marca guardada') });

  const pick = async (f?: File) => {
    if (!f) return;
    try {
      setLogo(await compressLogo(f));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cargar el logo');
    }
  };

  const valid = color === null || isHexColor(color);
  const scale = isHexColor(color) ? actionScale(color) : null;
  const dirty = logo !== initialLogo || color !== initialColor;

  return (
    <form
      className="bg-card shadow rounded-lg overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate({ logoUrl: logo ?? '', brandColor: color ?? '' });
      }}
    >
      <div className="px-4 py-5 sm:px-6 border-b border-border">
        <h3 className="text-lg leading-6 font-medium text-foreground">Tu marca</h3>
        <p className="mt-1 text-sm text-muted-foreground">Tu logo y tu color aparecen en la página donde reservan tus clientes.</p>
      </div>
      <div className="px-4 py-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">Logo</label>
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-xl border border-border bg-white flex items-center justify-center overflow-hidden">
                {logo ? <img src={logo} alt="Logo" className="h-full w-full object-contain" /> : <ImagePlus className="h-6 w-6 text-muted-foreground" />}
              </div>
              <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Subir logo" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
              <button type="button" onClick={() => file.current?.click()} className="px-3 py-2 text-sm border border-border rounded-md hover:bg-muted">
                {logo ? 'Cambiar logo' : 'Subir logo'}
              </button>
              {logo && (
                <button type="button" onClick={() => setLogo(null)} className="p-2 text-muted-foreground hover:text-red-600" aria-label="Quitar logo">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">PNG, JPG o WebP. Mejor cuadrado y con fondo transparente; se reduce solo.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Color</label>
            <div className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={`h-8 w-8 rounded-full border-2 ${color?.toUpperCase() === c ? 'border-foreground' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input type="color" aria-label="Elegir otro color" value={isHexColor(color) ? color : '#1F8A70'} onChange={(e) => setColor(e.target.value.toUpperCase())} className="h-8 w-10 p-0 border border-border rounded cursor-pointer bg-transparent" />
              {color && (
                <button type="button" onClick={() => setColor(null)} className="text-xs text-muted-foreground underline">
                  Quitar color
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Se ajusta solo para que el texto de los botones siempre se lea.</p>
          </div>
        </div>
        <div>
          <p className="block text-sm font-medium mb-2">Así lo verán tus clientes</p>
          <div className="rounded-xl border border-border overflow-hidden bg-muted">
            <div className="bg-card border-b border-border border-t-4 px-4 py-3 flex items-center gap-3" style={{ borderTopColor: scale?.[600] ?? 'var(--brand-accent)' }}>
              {logo && <img src={logo} alt="" className="h-10 w-10 rounded-lg object-contain bg-white border border-border" />}
              <div className="min-w-0">
                <p className="font-bold text-foreground truncate">{name}</p>
                <p className="text-xs text-muted-foreground">Reserva en línea</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <button type="button" tabIndex={-1} className="w-full py-2.5 rounded-lg text-white font-medium" style={{ backgroundColor: scale?.[600] ?? '#2563EB' }}>
                Reservar
              </button>
              <p className="text-sm font-medium" style={{ color: scale?.[600] ?? '#2563EB' }}>Cambiar o cancelar mi cita</p>
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 sm:px-6 border-t border-border flex justify-end">
        <button type="submit" disabled={update.isPending || !dirty || !valid} className="px-6 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
          {update.isPending ? 'Guardando...' : 'Guardar marca'}
        </button>
      </div>
    </form>
  );
};

const SalonBrandCard: React.FC = () => {
  const { data } = useBookingSettings();
  return data ? <SalonBrandForm name={data.name} initialLogo={data.logoUrl} initialColor={data.brandColor} /> : null;
};

export default SalonBrandCard;
