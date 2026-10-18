import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const escapeHtml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Código QR del enlace de reserva: se ve en pantalla, se descarga (SVG o PNG)
 * y se imprime como cartel para el local. Se genera en el navegador.
 */
const BookingQr: React.FC<{ url: string; salonName: string }> = ({ url, salonName }) => {
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

  const downloadPng = () => {
    const img = new Image();
    img.onload = () => {
      const size = 1024;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return toast.error('Tu navegador no puede generar la imagen');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob((blob) => (blob ? save(blob, 'qr-reservas.png') : toast.error('No se pudo crear la imagen')), 'image/png');
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };

  const printPoster = () => {
    const w = window.open('', '_blank', 'width=800,height=1000');
    if (!w) return toast.error('Permite las ventanas emergentes para imprimir el cartel');
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cartel de reservas</title>
<style>
  body{font-family:system-ui,sans-serif;text-align:center;margin:0;padding:48px 32px;color:#111}
  h1{font-size:44px;margin:0 0 8px} h2{font-size:30px;font-weight:600;margin:0 0 32px}
  .qr{width:420px;height:420px;margin:0 auto} .qr svg{width:100%;height:100%}
  p{font-size:20px;margin:24px 0 0;color:#444} .url{font-size:18px;word-break:break-all}
  @page{margin:12mm}
</style></head><body>
<h1>${escapeHtml(salonName)}</h1><h2>Reserva tu cita escaneando el código</h2>
<div class="qr">${svg}</div>
<p>Abre la cámara de tu móvil y apunta al código.</p><p class="url">${escapeHtml(url)}</p>
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
        <p className="text-muted-foreground">Imprímelo y ponlo en el local o en tu estado: tus clientes reservan escaneándolo.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={printPoster} disabled={!svg} className="px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted">
            Imprimir cartel
          </button>
          <button type="button" onClick={downloadPng} disabled={!svg} className="px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted">
            Descargar PNG
          </button>
          <button type="button" onClick={downloadSvg} disabled={!svg} className="px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted">
            Descargar SVG
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingQr;
