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
}

export interface Message {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;line-height:1.5">
<p>${lines.map(escapeHtml).join('<br>')}</p>
<ul style="padding-left:18px">${detail.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul>
${ctx.manageUrl ? `<p>${escapeHtml(manage[0])}<br><a href="${escapeHtml(ctx.manageUrl)}">${escapeHtml(ctx.manageUrl)}</a></p>` : ''}
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
