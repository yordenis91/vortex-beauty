import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authenticateToken } from '../middleware/auth';
import { appointmentScope, requirePermission } from '../middleware/can';

/**
 * Novedades de reservas para la campanita del panel (nueva, cambio, cancelación).
 * OWNER y ADMIN ven las de todo el salón; un STAFF, solo las de su profesional.
 * Nadie ve lo que hizo él mismo. Lo «no visto» es lo posterior a `notificationsSeenAt` del usuario.
 */
const router = Router();
router.use(authenticateToken, requirePermission('appointments:own'));

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(30),
  // Cursor: createdAt (ISO) de la última novedad recibida.
  before: z.string().datetime().optional(),
});

const seenBody = z.object({
  // Hasta qué novedad llegó a ver (por si entró otra mientras tenía el panel abierto).
  upTo: z.string().datetime().optional(),
});

async function scopeWhere(req: import('express').Request) {
  const scope = await appointmentScope(req);
  if (scope.none) return null;
  const userId = req.user!.userId;
  return {
    tenantId: req.user!.tenantId,
    ...(scope.professionalId ? { professionalId: scope.professionalId } : {}),
    // `not` en SQL descarta los NULL: las novedades de la clienta (sin actor) se piden aparte.
    OR: [{ actorUserId: null }, { actorUserId: { not: userId } }],
  };
}

// GET /api/activity
router.get('/', async (req, res) => {
  try {
    const query = listQuery.parse(req.query);
    const where = await scopeWhere(req);
    if (!where) return res.json({ items: [], unread: 0, nextCursor: null });

    const me = await prisma.user.findFirst({ where: { id: req.user!.userId, tenantId: req.user!.tenantId }, select: { notificationsSeenAt: true, createdAt: true } });
    const seenAt = me?.notificationsSeenAt ?? me?.createdAt ?? new Date(0);

    const [rows, unread] = await Promise.all([
      prisma.appointmentEvent.findMany({
        where: { ...where, ...(query.before ? { createdAt: { lt: new Date(query.before) } } : {}) },
        orderBy: { createdAt: 'desc' },
        take: query.limit + 1,
      }),
      prisma.appointmentEvent.count({ where: { ...where, createdAt: { gt: seenAt } } }),
    ]);

    const page = rows.slice(0, query.limit);
    res.json({
      items: page.map((e) => ({
        id: e.id,
        kind: e.kind,
        appointmentId: e.appointmentId,
        actor: e.actor,
        source: e.source,
        clientName: e.clientName,
        serviceName: e.serviceName,
        professionalName: e.professionalName,
        startsAt: e.startsAt,
        previousStartsAt: e.previousStartsAt,
        createdAt: e.createdAt,
        unread: e.createdAt > seenAt,
      })),
      unread,
      nextCursor: rows.length > query.limit ? page[page.length - 1].createdAt.toISOString() : null,
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') return res.status(400).json({ error: 'Parámetros inválidos', details: error.issues });
    console.error('Error listing activity:', error);
    res.status(500).json({ error: 'No se pudieron cargar las novedades' });
  }
});

// POST /api/activity/seen → marca como vistas las novedades hasta ahora (o hasta `upTo`).
router.post('/seen', async (req, res) => {
  try {
    const body = seenBody.parse(req.body ?? {});
    const now = new Date();
    const requested = body.upTo ? new Date(body.upTo) : now;
    const upTo = requested > now ? now : requested;

    // Nunca se retrocede: marcar como vista una novedad más antigua no vuelve a «no vistas» las posteriores.
    const me = await prisma.user.findFirst({ where: { id: req.user!.userId, tenantId: req.user!.tenantId }, select: { notificationsSeenAt: true } });
    if (!me) return res.status(404).json({ error: 'Usuario no encontrado' });
    const next = me.notificationsSeenAt && me.notificationsSeenAt > upTo ? me.notificationsSeenAt : upTo;
    await prisma.user.update({ where: { id: req.user!.userId }, data: { notificationsSeenAt: next } });
    res.json({ seenAt: next });
  } catch (error: any) {
    if (error?.name === 'ZodError') return res.status(400).json({ error: 'Parámetros inválidos', details: error.issues });
    console.error('Error marking activity as seen:', error);
    res.status(500).json({ error: 'No se pudo marcar como visto' });
  }
});

export default router;
