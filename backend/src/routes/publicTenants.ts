import express from 'express';
import prisma from '../prismaClient';

const router = express.Router();

// GET /api/public/tenants/:slug — información mínima y sin autenticación
// para la página pública de registro de un salón (/:tenantSlug/register).
// Solo expone lo estrictamente necesario para no filtrar datos del negocio.
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params as { slug: string };

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { name: true, slug: true, status: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Salón no encontrado' });
    }

    if (tenant.status === 'SUSPENDED') {
      return res.status(404).json({ error: 'Este salón no está disponible actualmente' });
    }

    res.json({ name: tenant.name, slug: tenant.slug });
  } catch (error) {
    console.error('Error obteniendo información pública del tenant:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
