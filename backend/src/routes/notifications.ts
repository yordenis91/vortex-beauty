import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import notificationService from '../services/notificationService';
import { retryNotification } from '../services/notifications/notifier';

const router = Router();

const logQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['PENDING', 'SENT', 'FAILED']).optional(),
  channel: z.enum(['EMAIL', 'TELEGRAM', 'WHATSAPP']).optional(),
  audience: z.enum(['CLIENTS', 'TEAM']).optional(),
});

/**
 * GET /api/notifications/log
 * Registro de envíos (correo y Telegram) del salón, paginado y con filtros por estado, canal y público (Solo ADMIN).
 */
router.get('/log', authenticateToken, requireAdmin, async (req: any, res: Response) => {
  try {
    const query = logQuery.parse(req.query);
    res.json(await notificationService.getSendLog(req.user.tenantId, query));
  } catch (error: any) {
    if (error?.name === 'ZodError') return res.status(400).json({ error: 'Parámetros inválidos', details: error.issues });
    console.error('Error fetching send log:', error);
    res.status(500).json({ error: 'No se pudo cargar el registro de envíos' });
  }
});

/**
 * POST /api/notifications/:id/retry
 * Reintenta un envío fallido (Solo ADMIN). Los ya enviados no se repiten.
 */
router.post('/:id/retry', authenticateToken, requireAdmin, async (req: any, res: Response) => {
  try {
    const result = await retryNotification(req.user.tenantId, String(req.params.id));
    if (result === 'not-retryable') return res.status(409).json({ error: 'Este envío no se puede reintentar.' });
    res.json({ result });
  } catch (error) {
    console.error('Error retrying notification:', error);
    res.status(500).json({ error: 'No se pudo reintentar el envío' });
  }
});

export default router;
