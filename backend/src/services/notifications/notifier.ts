import { Prisma } from '@prisma/client';
import prisma from '../../prismaClient';
import { config } from '../../config';
import { runWithTenant } from '../../lib/tenantContext';
import { sendEmail } from '../channels/email';
import { sendTelegram } from '../channels/telegram';
import {
  cancelledMessage,
  confirmedMessage,
  MessageContext,
  ownerAlert,
  professionalAlert,
  reminderMessage,
} from './templates';

/**
 * Envío de avisos de citas. Cada aviso se registra en la tabla Notification con
 * una clave de deduplicación, así que un trabajo reintentado no manda dos veces
 * el mismo correo. Las funciones públicas se ejecutan dentro del contexto del
 * salón (las lanza el worker).
 */

interface Loaded {
  appointment: Prisma.AppointmentGetPayload<{ include: { client: true; service: true; professional: true } }>;
  tenant: { name: string; slug: string; timezone: string };
  settings: { reminderHours: number[]; ownerAlerts: boolean; telegramBotToken: string | null; telegramChatId: string | null; cancelWindowHrs: number; labels: Record<string, string> };
  ctx: MessageContext;
}

async function load(tenantId: string, appointmentId: string): Promise<Loaded | null> {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, tenantId },
    include: { client: true, service: true, professional: true },
  });
  if (!appointment) return null;

  const [tenant, settingsRow] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, slug: true, timezone: true } }),
    prisma.tenantSettings.findUnique({ where: { tenantId } }),
  ]);
  const settings = {
    reminderHours: settingsRow?.reminderHours ?? [24, 2],
    ownerAlerts: settingsRow?.ownerAlerts ?? true,
    telegramBotToken: settingsRow?.telegramBotToken ?? null,
    telegramChatId: settingsRow?.telegramChatId ?? null,
    cancelWindowHrs: settingsRow?.cancelWindowHrs ?? 12,
    labels: (settingsRow?.labels as Record<string, string> | undefined) ?? {},
  };

  const ctx: MessageContext = {
    salonName: tenant.name,
    timezone: tenant.timezone,
    appointmentWord: settings.labels.appointment || 'cita',
    customerName: appointment.client.name,
    serviceName: appointment.serviceName,
    professionalName: appointment.professional?.name ?? null,
    startsAt: appointment.startsAt,
    price: `${Number(appointment.priceAmount).toFixed(2)} ${appointment.currency}`,
    manageUrl: appointment.cancelToken ? `${config.appPublicUrl}/${tenant.slug}/mi-cita/${appointment.cancelToken}` : null,
    cancelWindowHrs: settings.cancelWindowHrs,
    // Sin API_PUBLIC_URL no hay dónde apuntar la imagen: el correo sale sin logo.
    logoUrl: settingsRow?.logoUrl && config.apiPublicUrl ? `${config.apiPublicUrl}/api/public/booking/${tenant.slug}/logo` : null,
    brandColor: settingsRow?.brandColor ?? null,
  };
  return { appointment, tenant, settings, ctx };
}

type Channel = 'EMAIL' | 'TELEGRAM';

/**
 * Registra el aviso y lo envía. Devuelve 'retry' si el fallo es transitorio
 * (el worker relanza el trabajo) y 'done' en cualquier otro caso.
 */
async function deliver(params: {
  tenantId: string;
  channel: Channel;
  recipient: string;
  content: string;
  clientId?: string;
  dedupeKey: string;
  send: () => Promise<{ ok: true } | { ok: false; reason: string; retryable: boolean }>;
}): Promise<'done' | 'retry'> {
  const { tenantId, channel, recipient, content, clientId, dedupeKey } = params;

  let record = await prisma.notification.findUnique({ where: { tenantId_dedupeKey: { tenantId, dedupeKey } } });
  if (record?.status === 'SENT') return 'done';
  if (!record) {
    record = await prisma.notification.create({
      data: { tenantId, type: channel, recipient, content, clientId, dedupeKey, status: 'PENDING', isRead: true },
    });
  }

  const result = await params.send();
  await prisma.notification.update({
    where: { id: record.id },
    data: result.ok ? { status: 'SENT', errorLog: null } : { status: 'FAILED', errorLog: result.reason },
  });
  return !result.ok && result.retryable ? 'retry' : 'done';
}

async function ownerEmails(tenantId: string): Promise<string[]> {
  const owners = await prisma.user.findMany({ where: { tenantId, role: { in: ['OWNER'] } }, select: { email: true } });
  return owners.map((o) => o.email);
}

async function alertOwner(tenantId: string, data: Loaded, kind: 'created' | 'cancelled', keyBase: string, source: string): Promise<'done' | 'retry'> {
  if (!data.settings.ownerAlerts) return 'done';
  const text = ownerAlert(kind, data.ctx, source);
  const outcomes: Array<'done' | 'retry'> = [];

  if (data.settings.telegramBotToken && data.settings.telegramChatId) {
    const { telegramBotToken, telegramChatId } = data.settings;
    outcomes.push(
      await deliver({
        tenantId,
        channel: 'TELEGRAM',
        recipient: telegramChatId,
        content: text,
        dedupeKey: `${keyBase}:owner:telegram`,
        send: () => sendTelegram(telegramBotToken, telegramChatId, text),
      })
    );
  }
  for (const email of await ownerEmails(tenantId)) {
    outcomes.push(
      await deliver({
        tenantId,
        channel: 'EMAIL',
        recipient: email,
        content: text,
        dedupeKey: `${keyBase}:owner:email:${email}`,
        send: () => sendEmail({ to: email, subject: text.split('\n')[0], text, html: `<pre style="font-family:inherit">${text.replace(/</g, '&lt;')}</pre>` }),
      })
    );
  }
  return outcomes.includes('retry') ? 'retry' : 'done';
}

/** Avisa por Telegram al profesional dueño de la cita, si enlazó su chat. Nunca se repite con el chat del dueño. */
async function alertProfessional(tenantId: string, data: Loaded, kind: 'created' | 'cancelled', keyBase: string): Promise<'done' | 'retry'> {
  const chat = data.appointment.professional?.telegramChatId;
  const { telegramBotToken, telegramChatId: ownerChat } = data.settings;
  if (!chat || !telegramBotToken || (data.settings.ownerAlerts && chat === ownerChat)) return 'done';
  const text = professionalAlert(kind, data.ctx);
  return deliver({
    tenantId,
    channel: 'TELEGRAM',
    recipient: chat,
    content: text,
    dedupeKey: `${keyBase}:pro:telegram`,
    send: () => sendTelegram(telegramBotToken, chat, text),
  });
}

async function sendToCustomer(tenantId: string, data: Loaded, keyBase: string, message: { subject: string; text: string; html: string }): Promise<'done' | 'retry'> {
  const { client } = data.appointment;
  const { telegramBotToken } = data.settings;

  // Telegram primero si el cliente lo activó: es el canal que de verdad leen.
  if (client.telegramChatId && telegramBotToken) {
    const chatId = client.telegramChatId;
    let blocked = false;
    const outcome = await deliver({
      tenantId,
      channel: 'TELEGRAM',
      recipient: chatId,
      content: message.text,
      clientId: client.id,
      dedupeKey: `${keyBase}:customer:telegram`,
      send: async () => {
        const result = await sendTelegram(telegramBotToken, chatId, message.text);
        if (!result.ok && result.blocked) blocked = true;
        return result;
      },
    });
    if (!blocked) return outcome;
    // El cliente bloqueó el bot: se desenlaza y se intenta por correo.
    await prisma.client.update({ where: { id: client.id }, data: { telegramChatId: null } });
  }

  const email = client.email;
  if (!email) return 'done'; // cliente solo con teléfono y sin Telegram: sin canal
  return deliver({
    tenantId,
    channel: 'EMAIL',
    recipient: email,
    content: message.text,
    clientId: client.id,
    dedupeKey: `${keyBase}:customer:email`,
    send: () => sendEmail({ to: email, subject: message.subject, text: message.text, html: message.html }),
  });
}

const isActive = (status: string) => status === 'SCHEDULED' || status === 'PENDING';

export async function processConfirmed(tenantId: string, appointmentId: string): Promise<'done' | 'retry'> {
  return runWithTenant(tenantId, async () => {
    const data = await load(tenantId, appointmentId);
    if (!data || !isActive(data.appointment.status)) return 'done';
    const key = `confirmed:${appointmentId}:${data.appointment.startsAt.getTime()}`;
    const customer = await sendToCustomer(tenantId, data, key, confirmedMessage(data.ctx));
    const owner = await alertOwner(tenantId, data, 'created', key, data.appointment.source);
    const pro = await alertProfessional(tenantId, data, 'created', key);
    return [customer, owner, pro].includes('retry') ? 'retry' : 'done';
  });
}

export async function processReminder(tenantId: string, appointmentId: string, hoursBefore: number, startsAtMs: number): Promise<'done' | 'retry'> {
  return runWithTenant(tenantId, async () => {
    const data = await load(tenantId, appointmentId);
    if (!data || !isActive(data.appointment.status)) return 'done';
    // La cita se reprogramó después de encolar este recordatorio: el nuevo horario tiene los suyos.
    if (data.appointment.startsAt.getTime() !== startsAtMs) return 'done';
    if (data.appointment.startsAt.getTime() < Date.now()) return 'done';
    const key = `reminder:${appointmentId}:${startsAtMs}:${hoursBefore}`;
    return sendToCustomer(tenantId, data, key, reminderMessage(data.ctx, hoursBefore));
  });
}

export async function processCancelled(tenantId: string, appointmentId: string, by: 'CUSTOMER' | 'STAFF' | 'SYSTEM'): Promise<'done' | 'retry'> {
  return runWithTenant(tenantId, async () => {
    const data = await load(tenantId, appointmentId);
    if (!data || data.appointment.status !== 'CANCELLED') return 'done';
    const key = `cancelled:${appointmentId}:${data.appointment.startsAt.getTime()}`;
    // Si cancela el propio cliente, solo se avisa al dueño; si cancela el salón, también al cliente.
    const customer = by === 'CUSTOMER' ? 'done' : await sendToCustomer(tenantId, data, key, cancelledMessage(data.ctx, by));
    const owner = await alertOwner(tenantId, data, 'cancelled', key, data.appointment.source);
    const pro = await alertProfessional(tenantId, data, 'cancelled', key);
    return [customer, owner, pro].includes('retry') ? 'retry' : 'done';
  });
}
