import prisma from '../prismaClient';
import { runAsAdmin } from '../lib/tenantContext';
import { NotificationType, NotificationStatus } from '@prisma/client';

/** Canales de envío reales. Las filas SYSTEM antiguas no son envíos y no salen en el registro. */
const SEND_CHANNELS: NotificationType[] = ['EMAIL', 'TELEGRAM', 'WHATSAPP'];

export interface LogQuery {
  page: number;
  pageSize: number;
  status?: NotificationStatus;
  channel?: NotificationType;
  /** 'CLIENTS' = avisos a clientas; 'TEAM' = avisos al dueño y al equipo. */
  audience?: 'CLIENTS' | 'TEAM';
}

/**
 * Registro de envíos del salón, paginado y filtrable. Los totales por estado
 * respetan el canal y el público elegidos, pero no el estado (así los filtros se pueden cambiar).
 */
export async function getSendLog(tenantId: string, query: LogQuery) {
  const base = {
    tenantId,
    type: query.channel ? query.channel : { in: SEND_CHANNELS },
    ...(query.audience === 'CLIENTS' ? { clientId: { not: null } } : query.audience === 'TEAM' ? { clientId: null } : {}),
  };
  const where = { ...base, ...(query.status ? { status: query.status } : {}) };

  const [items, total, grouped] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: { client: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.notification.count({ where }),
    prisma.notification.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
  ]);

  const counts = { PENDING: 0, SENT: 0, FAILED: 0 };
  for (const row of grouped) counts[row.status] = row._count._all;
  // Solo los envíos de avisos de citas se pueden reintentar (el resumen diario, por ejemplo, no).
  const withRetry = items.map((n) => ({ ...n, retryable: n.status === 'FAILED' && /^(confirmed|cancelled|reminder|rescheduled):/.test(n.dedupeKey ?? '') }));
  return { items: withRetry, total, page: query.page, pageSize: query.pageSize, counts };
}

/** Días que se conserva el registro de envíos. */
export const NOTIFICATION_RETENTION_DAYS = 90;

/** Borra los envíos con más de 90 días de todos los salones. Devuelve cuántos borró. */
export async function pruneOldNotifications(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * 24 * 3600 * 1000);
  const result = await runAsAdmin(() => prisma.notification.deleteMany({ where: { createdAt: { lt: cutoff } } }));
  return result.count;
}

export default {
  getSendLog,
  pruneOldNotifications,
};
