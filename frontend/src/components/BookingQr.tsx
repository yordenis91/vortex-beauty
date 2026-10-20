import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { brand } from '../brand/brand';
import { POSTER_HEIGHT, POSTER_WIDTH, posterSvg } from '../lib/poster';

/**
 * Código QR del enlace de reserva: se ve en pantalla, se descarga (SVG) y se
 * convierte en un cartel con el logo y el color del salón, para imprimir o
 * compartir como imagen. Se genera en el navegador.
 */
const BookingQr: React.FC<{ url: string; salonName: string; logoUrl?: string | null; brandColor?: string | null }> = ({
  url,
  salonName,
  logoUrl,
  brandColor,
}) => {
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let cancelled = false;
    // La librería se carga solo al abrir Ajustes: no pesa en las páginas públicas.
    import('qrcode').then(({ default: QRCode }) =>
      QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', width: 256 }).then((out) => {
        if (!cancelled) setSvg(out);
      })
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  const save = (blob: Blob, name: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const downloadSvg = () => save(new Blob([svg], { type: 'image/svg+xml' }), 'qr-reservas.svg');

  const poster = () =>
    posterSvg({ qrSvg: svg, salonName, url, logoUrl, brandColor, fallbackColor: brand.colors.ink, platformName: brand.name });

  const downloadPoster = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = POSTER_WIDTH;
      canvas.height = POSTER_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) return toast.error('Tu navegador no puede generar la imagen');
      ctx.drawImage(img, 0, 0, POSTER_WIDTH, POSTER_HEIGHT);
      canvas.toBlob((blob) => (blob ? save(blob, 'cartel-reservas.png') : toast.error('No se pudo crear la imagen')), 'image/png');
    };
    img.onerror = () => toast.error('No se pudo crear la imagen');
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(poster())}`;
  };

  const printPoster = () => {
    const w = window.open('', '_blank', 'width=800,height=1100');
    if (!w) return toast.error('Permite las ventanas emergentes para imprimir el cartel');
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cartel de reservas</title>
<style>
  html,body{margin:0;background:#fff} svg{display:block;width:100%;height:auto;max-height:100vh}
  @page{margin:0}
</style></head><body>${poster()}
<script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="flex flex-col sm:flex-row items-start gap-4">
      <div
        className="w-36 h-36 shrink-0 rounded-lg bg-white border border-border p-1 [&>svg]:w-full [&>svg]:h-full"
        role="img"
        aria-label="Código QR de reservas"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="space-y-2 text-sm">
        <p className="text-muted-foreground">El cartel lleva tu logo y tu color. Imprímelo para el local o descárgalo como imagen para tu estado de WhatsApp o Instagram.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={printPoster} disabled={!svg} className="px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted">
            Imprimir cartel
          </button>
          <button type="button" onClick={downloadPoster} disabled={!svg} className="px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted">
            Descargar cartel (PNG)
          </button>
          <button type="button" onClick={downloadSvg} disabled={!svg} className="px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted">
            Descargar solo el QR
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingQr;
