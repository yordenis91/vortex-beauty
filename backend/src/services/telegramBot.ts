import crypto from 'node:crypto';
import prisma from '../prismaClient';
import { config } from '../config';
import { sendTelegram, telegramApi } from './channels/telegram';
import { formatLocalDateTime } from '../lib/time';

/**
 * Bot de Telegram de cada salón (token propio de @BotFather).
 *
 * - Clientes: tras reservar tocan "Recibir avisos por Telegram" (enlace t.me con
 *   su token secreto de la cita como parámetro de /start). El bot enlaza ese chat
 *   con su ficha de cliente y desde entonces los avisos salen por Telegram.
 * - Dueño: envía /vincular <código> al bot para recibir los avisos del salón.
 * - Profesional: envía /vincular <su código> (lo ve en Mi perfil) para recibir los avisos
 *   solo de sus propias citas.
 * Funciona con webhook: Telegram llama a /api/telegram/webhook/:tenantId con una
 * cabecera secreta distinta por salón.
 */

export const WEBHOOK_SECRET_HEADER = 'x-telegram-bot-api-secret-token';

const newSecret = () => crypto.randomBytes(24).toString('hex');
const newOwnerCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();
export const newLinkCode = newOwnerCode;

export const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export class BotSetupError extends Error {}

/**
 * Valida el token, registra el webhook y guarda usuario del bot, secreto y código
 * del dueño. `apiBaseUrl` es la URL pública del API (https) a la que llamará Telegram.
 */
export async function connectBot(tenantId: string, token: string, apiBaseUrl: string): Promise<void> {
  const me = await telegramApi(token, 'getMe');
  if (!me.ok || !me.result?.username) {
    throw new BotSetupError('Telegram no reconoce ese token. Cópialo de nuevo desde @BotFather.');
  }
  const secret = newSecret();
  const hook = await telegramApi(token, 'setWebhook', {
    url: `${apiBaseUrl}/api/telegram/webhook/${tenantId}`,
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  });
  if (!hook.ok) {
    throw new BotSetupError(`No se pudo activar el bot: ${hook.description ?? 'Telegram rechazó el webhook'}. Comprueba que el API tiene HTTPS público.`);
  }
  await prisma.tenantSettings.update({
    where: { tenantId },
    data: {
      telegramBotToken: token,
      telegramBotUsername: me.result.username,
      telegramWebhookSecret: secret,
      telegramOwnerCode: newOwnerCode(),
    },
  });
}

export async function disconnectBot(tenantId: string, token: string | null): Promise<void> {
  if (token) await telegramApi(token, 'deleteWebhook', { drop_pending_updates: true });
  await prisma.tenantSettings.update({
    where: { tenantId },
    data: { telegramBotToken: null, telegramBotUsername: null, telegramWebhookSecret: null, telegramOwnerCode: null, telegramChatId: null },
  });
  await prisma.client.updateMany({ where: { tenantId, telegramChatId: { not: null } }, data: { telegramChatId: null } });
  await prisma.professional.updateMany({ where: { tenantId }, data: { telegramChatId: null, telegramLinkCode: null } });
}

/** Base pública del API: `API_PUBLIC_URL` si existe, si no la de la petición actual. */
export function apiBaseUrl(req: { protocol: string; get(name: string): string | undefined }): string {
  if (config.apiPublicUrl) return config.apiPublicUrl;
  return `${req.protocol}://${req.get('host')}`;
}

// ---------- Mensajes entrantes ----------

interface Update {
  message?: { text?: string; chat?: { id: number | string; type?: string } };
}

const HELP =
  'Hola 👋 Este bot te avisa de tus citas.\n\n' +
  'Para activarlo, reserva en la página del salón y toca «Recibir avisos por Telegram» en tu confirmación.\n\n' +
  'Comandos:\n/citas — tus próximas citas\n/historial — tus últimos trabajos\n/parar — dejar de recibir avisos';

export async function handleUpdate(tenantId: string, update: Update): Promise<void> {
  const text = update.message?.text?.trim();
  const chatId = update.message?.chat?.id;
  if (!text || chatId === undefined || update.message?.chat?.type !== 'private') return;
  const chat = String(chatId);

  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
  const token = settings?.telegramBotToken;
  if (!token) return;
  const reply = (msg: string) => sendTelegram(token, chat, msg);

  const [command, arg] = text.split(/\s+/, 2);
  const cmd = command.toLowerCase().replace(/@\w+$/, '');

  if (cmd === '/vincular') {
    const code = arg?.toUpperCase();
    if (code && settings.telegramOwnerCode && safeEqual(code, settings.telegramOwnerCode)) {
      await prisma.tenantSettings.update({ where: { tenantId }, data: { telegramChatId: chat, telegramOwnerCode: newOwnerCode() } });
      await reply('✅ Listo: recibirás aquí los avisos de reservas de tu salón.');
      return;
    }
    // Código de un profesional (Mi perfil): enlaza este chat solo a sus citas. Es de un solo uso.
    const professional = code ? await prisma.professional.findFirst({ where: { tenantId, telegramLinkCode: code }, select: { id: true, name: true } }) : null;
    if (professional) {
      await prisma.professional.update({ where: { id: professional.id }, data: { telegramChatId: chat, telegramLinkCode: null } });
      await reply(`✅ Listo, ${professional.name}: recibirás aquí los avisos de tus citas (nuevas y canceladas). /parar para dejar de recibirlos.`);
      return;
    }
    await reply('Código inválido. Cópialo de tu panel: el dueño en Ajustes → Telegram, un profesional en Mi perfil.');
    return;
  }

  if (cmd === '/start' && arg) {
    const appointment = await prisma.appointment.findFirst({
      where: { tenantId, cancelToken: arg },
      include: { client: true },
    });
    if (!appointment) {
      await reply('Ese enlace ya no es válido. Reserva de nuevo desde la página del salón.');
      return;
    }
    await prisma.client.update({ where: { id: appointment.clientId }, data: { telegramChatId: chat } });
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, timezone: true } });
    await reply(
      `✅ Avisos activados, ${appointment.client.name}.\n\n` +
        `${tenant.name}\n${appointment.serviceName}\n${formatLocalDateTime(tenant.timezone, appointment.startsAt)}\n\n` +
        'Te escribiremos aquí para confirmar y recordarte tus citas. /citas para verlas, /historial para ver tus trabajos anteriores, /parar para dejar de recibirlas.'
    );
    return;
  }

  if (cmd === '/parar' || cmd === '/stop') {
    const { count } = await prisma.client.updateMany({ where: { tenantId, telegramChatId: chat }, data: { telegramChatId: null } });
    const pros = await prisma.professional.updateMany({ where: { tenantId, telegramChatId: chat }, data: { telegramChatId: null } });
    await reply(count || pros.count ? 'Listo, no te enviaremos más avisos por aquí.' : 'No tenías avisos activados.');
    return;
  }

  if (cmd === '/citas') {
    const clients = await prisma.client.findMany({ where: { tenantId, telegramChatId: chat }, select: { id: true } });
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { slug: true, timezone: true } });
    const upcoming = clients.length
      ? await prisma.appointment.findMany({
          where: { tenantId, clientId: { in: clients.map((c) => c.id) }, status: { in: ['SCHEDULED', 'PENDING'] }, startsAt: { gt: new Date() } },
          orderBy: { startsAt: 'asc' },
          take: 5,
        })
      : [];
    if (!upcoming.length) {
      await reply('No tienes citas próximas.');
      return;
    }
    await reply(
      upcoming
        .map((a) => `• ${formatLocalDateTime(tenant.timezone, a.startsAt)} — ${a.serviceName}${a.cancelToken ? `\n  ${config.appPublicUrl}/${tenant.slug}/mi-cita/${a.cancelToken}` : ''}`)
        .join('\n')
    );
    return;
  }

  if (cmd === '/historial') {
    const clients = await prisma.client.findMany({ where: { tenantId, telegramChatId: chat }, select: { id: true } });
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { timezone: true } });
    const done = clients.length
      ? await prisma.appointment.findMany({
          where: { tenantId, clientId: { in: clients.map((c) => c.id) }, status: 'COMPLETED' },
          include: { professional: { select: { name: true } } },
          orderBy: { startsAt: 'desc' },
          take: 5,
        })
      : [];
    if (!done.length) {
      await reply('Aún no tienes trabajos realizados.');
      return;
    }
    await reply(
      'Tus últimos trabajos:\n' +
        done
          .map((a) => `• ${formatLocalDateTime(tenant.timezone, a.startsAt)} — ${a.serviceName}${a.professional ? ` con ${a.professional.name}` : ''}`)
          .join('\n')
    );
    return;
  }

  await reply(HELP);
}
