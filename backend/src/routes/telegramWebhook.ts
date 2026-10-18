import { Router } from 'express';
import { basePrisma } from '../prismaClient';
import prisma from '../prismaClient';
import { runWithTenant } from '../lib/tenantContext';
import { handleUpdate, safeEqual, WEBHOOK_SECRET_HEADER } from '../services/telegramBot';

/**
 * Webhook de los bots de Telegram: POST /api/telegram/webhook/:tenantId.
 * Se autentica con la cabecera secreta que Telegram devuelve (la que se
 * registró en setWebhook). Siempre responde 200 rápido para que Telegram no reintente.
 */
const router = Router();

router.post('/webhook/:tenantId', async (req, res) => {
  const tenantId = String(req.params.tenantId);
  const given = String(req.get(WEBHOOK_SECRET_HEADER) ?? '');
  try {
    const tenant = await basePrisma.tenant.findUnique({ where: { id: tenantId }, select: { status: true } });
    if (!tenant || tenant.status === 'SUSPENDED') return res.sendStatus(404);

    await runWithTenant(tenantId, async () => {
      const settings = await prisma.tenantSettings.findUnique({ where: { tenantId }, select: { telegramWebhookSecret: true } });
      if (!settings?.telegramWebhookSecret || !given || !safeEqual(given, settings.telegramWebhookSecret)) {
        res.sendStatus(401);
        return;
      }
      res.sendStatus(200);
      await handleUpdate(tenantId, req.body ?? {}).catch((error) => console.error('[telegram] error procesando mensaje:', error));
    });
  } catch (error) {
    console.error('[telegram] webhook:', error);
    if (!res.headersSent) res.sendStatus(500);
  }
});

export default router;
