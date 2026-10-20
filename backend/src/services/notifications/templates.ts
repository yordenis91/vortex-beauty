import { formatLocalDateTime } from '../../lib/time';

/** Datos que necesitan los mensajes; los carga notifier.ts. */
export interface MessageContext {
  salonName: string;
  timezone: string;
  /** Vocabulario del salón (cita/turno/reserva...). */
  appointmentWord: string;
  customerName: string;
  serviceName: string;
  professionalName: string | null;
  startsAt: Date;
  price: string; // ya formateado, p. ej. "25.00 USD"
  manageUrl: string | null;
  cancelWindowHrs: number;
  /** Logo del salón como URL pública (los correos no muestran imágenes incrustadas), y su color. */
  logoUrl?: string | null;
  brandColor?: string | null;
}

export interface Message {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Texto blanco o negro, el que más contraste dé sobre el color del botón. */
function readableOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111111' : '#ffffff';
}

function render(subject: string, lines: string[], ctx: MessageContext, footer?: string): Message {
  const when = formatLocalDateTime(ctx.timezone, ctx.startsAt);
  const detail = [
    `Servicio: ${ctx.serviceName}`,
    `Cuándo: ${when}`,
    ...(ctx.professionalName ? [`Con: ${ctx.professionalName}`] : []),
    `Precio: ${ctx.price}`,
  ];
  const manage = ctx.manageUrl
    ? [
        ctx.cancelWindowHrs > 0
          ? `Puedes cambiar o cancelar hasta ${ctx.cancelWindowHrs} horas antes:`
          : 'Puedes cambiar o cancelar desde este enlace:',
        ctx.manageUrl,
      ]
    : [];
  const text = [...lines, '', ...detail, ...(manage.length ? ['', ...manage] : []), ...(footer ? ['', footer] : []), '', `— ${ctx.salonName}`].join('\n');
  const color = ctx.brandColor && HEX.test(ctx.brandColor) ? ctx.brandColor : '#14213D';
  const header = `<div style="border-top:4px solid ${color};padding:16px 0 8px">${
    ctx.logoUrl ? `<img src="${escapeHtml(ctx.logoUrl)}" alt="${escapeHtml(ctx.salonName)}" height="48" style="height:48px;max-width:200px;object-fit:contain;vertical-align:middle;margin-right:10px">` : ''
  }<strong style="font-size:18px;vertical-align:middle">${escapeHtml(ctx.salonName)}</strong></div>`;
  const button = ctx.manageUrl
    ? `<p><a href="${escapeHtml(ctx.manageUrl)}" style="display:inline-block;background:${color};color:${readableOn(color)};text-decoration:none;padding:10px 18px;border-radius:6px">Ver o cambiar mi cita</a></p>`
    : '';
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;line-height:1.5">
${header}
<p>${lines.map(escapeHtml).join('<br>')}</p>
<ul style="padding-left:18px">${detail.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul>
${ctx.manageUrl ? `<p>${escapeHtml(manage[0])}</p>${button}<p style="font-size:12px;color:#666">${escapeHtml(ctx.manageUrl)}</p>` : ''}
${footer ? `<p>${escapeHtml(footer)}</p>` : ''}
<p style="color:#666">— ${escapeHtml(ctx.salonName)}</p></div>`;
  return { subject, text, html };
}

const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

export const confirmedMessage = (ctx: MessageContext) =>
  render(`Confirmación de tu ${ctx.appointmentWord} en ${ctx.salonName}`, [`Hola ${ctx.customerName},`, `Confirmamos tu ${ctx.appointmentWord}.`], ctx);

export const reminderMessage = (ctx: MessageContext, hoursBefore: number) =>
  render(
    `Recordatorio de tu ${ctx.appointmentWord} ${hoursBefore >= 24 ? 'mañana' : 'en unas horas'} en ${ctx.salonName}`,
    [`Hola ${ctx.customerName},`, `Te recordamos tu ${ctx.appointmentWord}:`],
    ctx
  );

export const cancelledMessage = (ctx: MessageContext, by: 'CUSTOMER' | 'STAFF' | 'SYSTEM') =>
  render(
    `Cancelación de tu ${ctx.appointmentWord} en ${ctx.salonName}`,
    [`Hola ${ctx.customerName},`, by === 'CUSTOMER' ? `Cancelamos tu ${ctx.appointmentWord}, como pediste.` : `El salón canceló tu ${ctx.appointmentWord}. Disculpa las molestias.`],
    { ...ctx, manageUrl: null }
  );

/** Aviso corto para el dueño (correo y Telegram). */
export function ownerAlert(kind: 'created' | 'cancelled', ctx: MessageContext, source: string): string {
  const when = formatLocalDateTime(ctx.timezone, ctx.startsAt);
  const head = `${cap(ctx.appointmentWord)}: ${kind === 'created' ? 'nueva reserva' : 'cancelación'}`;
  return [
    `${head} · ${ctx.salonName}`,
    `${ctx.customerName} — ${ctx.serviceName}`,
    `${when}${ctx.professionalName ? ` · ${ctx.professionalName}` : ''}`,
    ...(kind === 'created' ? [`Origen: ${source}`] : []),
  ].join('\n');
}

/** Aviso corto para el profesional: solo lo que le toca a él. */
export function professionalAlert(kind: 'created' | 'cancelled', ctx: MessageContext): string {
  const when = formatLocalDateTime(ctx.timezone, ctx.startsAt);
  return [
    `${kind === 'created' ? `Nueva ${ctx.appointmentWord} para ti` : `${cap(ctx.appointmentWord)} cancelada`} · ${ctx.salonName}`,
    `${ctx.customerName} — ${ctx.serviceName}`,
    when,
  ].join('\n');
}
