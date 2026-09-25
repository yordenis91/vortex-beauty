import express from 'express';
import { validateWebhookSignature, InvalidWebhookSignatureError, isMercadoPagoConfigured } from '../services/mercadoPagoService';
import { reconcilePreapproval, reconcilePayment } from '../services/billingReconciliation';

const router = express.Router();

// POST /api/webhooks/mercadopago — recibe notificaciones de Mercado Pago
// sobre suscripciones (`subscription_preapproval`) y cobros (`payment`).
// Siempre responde rápido: el webhook solo dispara un "andá a mirar esto"
// (reconcilePreapproval/reconcilePayment vuelven a pedirle el detalle
// completo a Mercado Pago), nunca confiamos en el cuerpo del POST como
// fuente de verdad.
router.post('/', async (req, res) => {
  try {
    if (!isMercadoPagoConfigured()) {
      return res.status(503).end();
    }

    try {
      validateWebhookSignature(req);
    } catch (error) {
      if (error instanceof InvalidWebhookSignatureError) {
        console.warn('Webhook de Mercado Pago con firma inválida:', error.reason);
        return res.status(401).json({ error: 'Firma inválida' });
      }
      throw error;
    }

    const topic = (req.query.type as string) || (req.query.topic as string) || req.body?.type;
    const dataId = (req.query['data.id'] as string) || req.body?.data?.id;

    // Responder 200 de inmediato y procesar: Mercado Pago reintenta si no
    // recibe 2xx a tiempo, y no necesita esperar a que terminemos de
    // reconciliar contra nuestra base de datos.
    res.status(200).end();

    if (!dataId) return;

    if (topic === 'subscription_preapproval' || topic === 'preapproval') {
      await reconcilePreapproval(String(dataId));
    } else if (topic === 'payment') {
      await reconcilePayment(String(dataId));
    }
  } catch (error) {
    console.error('Error procesando webhook de Mercado Pago:', error);
    if (!res.headersSent) {
      res.status(500).end();
    }
  }
});

export default router;
