import prisma from '../../prismaClient';
import { runAsAdmin, runWithTenant } from '../../lib/tenantContext';
import { instantToLocal, localDayRange } from '../../lib/time';
import { sendTelegram } from '../channels/telegram';
import { deliver } from './notifier';
import { summaryText, type SummaryLine as Line } from './templates';

/**
 * Resumen de las citas del día por Telegram, a las 8:00 de la zona horaria del salón.
 * El dueño recibe todas; cada profesional con su chat enlazado, solo las suyas.
 * Sin citas no se manda nada. La clave de deduplicación evita repetirlo si el trabajo se reintenta
 * o la hora se revisa dos veces.
 */
export const SUMMARY_HOUR = 8;

/** Envía los resúmenes que toquen en este momento. `retry` si alguno falló por un motivo transitorio. */
export async function sendDailySummaries(now: Date = new Date()): Promise<{ sent: number; retry: boolean }> {
  const tenants = await runAsAdmin(() =>
    prisma.tenant.findMany({
      where: { status: { not: 'SUSPENDED' }, settings: { is: { dailySummary: true, telegramBotToken: { not: null } } } },
      select: { id: true, name: true, timezone: true },
    })
  );

  let sent = 0;
  let retry = false;
  for (const tenant of tenants) {
    const local = instantToLocal(tenant.timezone, now);
    if (Number(local.time.slice(0, 2)) !== SUMMARY_HOUR) continue;
    try {
      const result = await runWithTenant(tenant.id, () => summarizeTenant(tenant, local.dateStr));
      sent += result.sent;
      retry ||= result.retry;
    } catch (error) {
      console.error(`[resumen] salón ${tenant.id}:`, (error as Error).message);
      retry = true;
    }
  }
  return { sent, retry };
}

async function summarizeTenant(tenant: { id: string; name: string; timezone: string }, dateStr: string): Promise<{ sent: number; retry: boolean }> {
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: tenant.id } });
  const token = settings?.telegramBotToken;
  if (!token) return { sent: 0, retry: false };
  const labels = (settings?.labels as Record<string, string> | undefined) ?? {};
  const word = { one: labels.appointment || 'cita', many: labels.appointments || `${labels.appointment || 'cita'}s` };

  const { start, end } = localDayRange(tenant.timezone, dateStr);
  const appointments = await prisma.appointment.findMany({
    where: { tenantId: tenant.id, startsAt: { gte: start, lt: end }, status: { in: ['SCHEDULED', 'PENDING'] } },
    include: { client: { select: { name: true } }, professional: { select: { id: true, name: true, telegramChatId: true } } },
    orderBy: { startsAt: 'asc' },
  });
  if (appointments.length === 0) return { sent: 0, retry: false };

  const toLine = (a: (typeof appointments)[number]): Line => ({
    time: instantToLocal(tenant.timezone, a.startsAt).time,
    client: a.client.name,
    service: a.serviceName,
    professional: a.professional?.name ?? null,
    pending: a.status === 'PENDING',
  });

  let sent = 0;
  let retry = false;
  const send = async (chat: string, text: string, key: string) => {
    const outcome = await deliver({ tenantId: tenant.id, channel: 'TELEGRAM', recipient: chat, content: text, dedupeKey: `daily:${dateStr}:${key}`, send: () => sendTelegram(token, chat, text) });
    if (outcome === 'retry') retry = true;
    else sent += 1;
  };

  const ownerChat = settings?.telegramChatId;
  if (ownerChat) await send(ownerChat, summaryText(tenant.name, dateStr, word, appointments.map(toLine), true), 'owner');

  const byProfessional = new Map<string, { chat: string; lines: Line[] }>();
  for (const a of appointments) {
    const chat = a.professional?.telegramChatId;
    if (!a.professional || !chat || chat === ownerChat) continue;
    const entry = byProfessional.get(a.professional.id) ?? { chat, lines: [] };
    entry.lines.push(toLine(a));
    byProfessional.set(a.professional.id, entry);
  }
  for (const [id, { chat, lines }] of byProfessional) await send(chat, summaryText(tenant.name, dateStr, word, lines, false), `pro:${id}`);

  return { sent, retry };
}
