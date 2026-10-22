import { Request, Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import prisma, { basePrisma } from '../prismaClient';
import { config } from '../config';
import { authenticateToken } from '../middleware/auth';
import { appointmentScope, requirePermission } from '../middleware/can';
import { runWithTenant } from '../lib/tenantContext';
import { buildIcs, IcsEvent } from '../lib/ics';

/**
 * Suscripción de la agenda a Google Calendar, Apple Calendar u Outlook.
 *
 * - /api/calendar-feed (con sesión): ver si hay enlace, crearlo o regenerarlo, desactivarlo.
 *   El enlace completo solo se muestra al crearlo: en la base queda únicamente su hash.
 * - /api/calendar/:token.ics (público): lo consulta el programa de calendario. El token es la credencial.
 *   Un dueño o administrador recibe toda la agenda; un profesional, solo la suya.
 */

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export const calendarFeedRouter = Router();
calendarFeedRouter.use(authenticateToken, requirePermission('appointments:own'));

const feedUrl = (req: Request, token: string) => {
  const base = config.apiPublicUrl || `${req.protocol}://${req.get('host')}`;
  return `${base}/api/calendar/${token}.ics`;
};

calendarFeedRouter.get('/', async (req, res) => {
  const feed = await basePrisma.calendarFeed.findUnique({ where: { userId: req.user!.userId }, select: { createdAt: true, lastUsedAt: true } });
  res.json({ active: !!feed, createdAt: feed?.createdAt ?? null, lastUsedAt: feed?.lastUsedAt ?? null });
});

// Crea el enlace o, si ya había uno, lo reemplaza (el anterior deja de funcionar).
calendarFeedRouter.post('/', async (req, res) => {
  const scope = await appointmentScope(req);
  if (scope.none) return res.status(403).json({ error: 'No tienes un perfil de profesional asociado' });
  const token = randomBytes(32).toString('base64url');
  const { userId, tenantId } = req.user!;
  await basePrisma.calendarFeed.upsert({
    where: { userId },
    create: { userId, tenantId, tokenHash: hash(token) },
    update: { tokenHash: hash(token), createdAt: new Date(), lastUsedAt: null },
  });
  res.status(201).json({ active: true, url: feedUrl(req, token) });
});

calendarFeedRouter.delete('/', async (req, res) => {
  await basePrisma.calendarFeed.deleteMany({ where: { userId: req.user!.userId } });
  res.status(204).end();
});

// ---------- Público ----------

export const calendarPublicRouter = Router();

const limiter = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.PUBLIC_READ_LIMIT) || 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const PAST_DAYS = 30;
const FUTURE_DAYS = 365;
const MAX_EVENTS = 2000;

calendarPublicRouter.get('/:file', limiter, async (req, res) => {
  const token = String(req.params.file).replace(/\.ics$/i, '');
  if (token.length < 30) return res.status(404).end();

  const feed = await basePrisma.calendarFeed.findUnique({ where: { tokenHash: hash(token) } });
  if (!feed) return res.status(404).end();

  const ics = await runWithTenant(feed.tenantId, async () => {
    const user = await prisma.user.findFirst({ where: { id: feed.userId, tenantId: feed.tenantId, isActive: true }, select: { role: true } });
    if (!user) return null;
    const scope = await appointmentScope({ user: { role: user.role, userId: feed.userId, tenantId: feed.tenantId } } as Request);
    if (scope.none) return null;

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: feed.tenantId }, select: { name: true } });
    const now = Date.now();
    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId: feed.tenantId,
        startsAt: { gte: new Date(now - PAST_DAYS * 86400_000), lt: new Date(now + FUTURE_DAYS * 86400_000) },
        status: { in: ['SCHEDULED', 'PENDING', 'COMPLETED', 'CANCELLED'] },
        ...(scope.professionalId ? { professionalId: scope.professionalId } : {}),
      },
      include: { client: { select: { name: true, phone: true } }, professional: { select: { name: true } } },
      orderBy: { startsAt: 'asc' },
      take: MAX_EVENTS,
    });

    const events: IcsEvent[] = appointments.map((a) => ({
      uid: `${a.id}@afilao`,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      summary: `${a.client.name} · ${a.serviceName}`,
      description: [a.client.phone ? `Teléfono: ${a.client.phone}` : null, a.professional ? `Con: ${a.professional.name}` : null, a.status === 'PENDING' ? 'Pendiente de confirmar' : null, a.notes].filter(Boolean).join('\n'),
      location: tenant.name,
      cancelled: a.status === 'CANCELLED',
      updatedAt: a.updatedAt,
    }));
    return buildIcs(`Citas · ${tenant.name}`, events);
  });
  if (ics === null) return res.status(404).end();

  void basePrisma.calendarFeed.update({ where: { id: feed.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=300', 'Content-Disposition': 'inline; filename="citas.ics"' });
  res.send(ics);
});
