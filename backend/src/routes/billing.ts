import express from 'express';
import prisma from '../prismaClient';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { isMercadoPagoConfigured, createCheckout } from '../services/mercadoPagoService';

const router = express.Router();

router.use(authenticateToken);

// GET /api/billing/status — estado de la suscripción del propio salón, para
// su pantalla de Facturación.
router.get('/status', async (req, res) => {
  try {
    const tenantId = (req as any).user.tenantId;

    const subscription = await prisma.tenantSubscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    res.json({
      subscription,
      mercadoPagoConfigured: isMercadoPagoConfigured(),
    });
  } catch (error) {
    console.error('Error obteniendo estado de facturación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/billing/checkout — genera la URL de autorización de Mercado
// Pago para el plan/ciclo que el salón ya tiene asignado, y redirige al
// admin del salón ahí a conectar su tarjeta. Solo ADMIN del salón.
router.post('/checkout', requireAdmin, async (req, res) => {
  try {
    if (!isMercadoPagoConfigured()) {
      return res.status(503).json({ error: 'La pasarela de pago todavía no está configurada en esta plataforma.' });
    }

    const tenantId = (req as any).user.tenantId;

    const [subscription, requester] = await Promise.all([
      prisma.tenantSubscription.findUnique({ where: { tenantId }, include: { plan: true } }),
      prisma.user.findUnique({ where: { id: (req as any).user.userId }, select: { email: true } }),
    ]);

    if (!subscription) {
      return res.status(404).json({ error: 'Este salón todavía no tiene un plan asignado. Contacta a soporte.' });
    }
    if (!requester) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const checkout = await createCheckout({
      tenantId,
      plan: subscription.plan,
      billingCycle: subscription.billingCycle,
      payerEmail: requester.email,
    });

    await prisma.tenantSubscription.update({
      where: { id: subscription.id },
      data: { externalSubscriptionId: checkout.preapprovalId, gateway: 'mercadopago' },
    });

    res.json({ redirectUrl: checkout.redirectUrl });
  } catch (error) {
    console.error('Error creando checkout de Mercado Pago:', error);
    res.status(500).json({ error: 'No se pudo iniciar el pago. Inténtalo de nuevo en unos minutos.' });
  }
});

export default router;
