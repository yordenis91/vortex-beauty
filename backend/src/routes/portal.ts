import express from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import prisma from '../prismaClient';
import { imageSchema } from '../lib/images';
import { runInTransaction } from '../lib/db';

const router = express.Router();

// Perfil de la cuenta propia (mi perfil). El resto del portal de clientes se retiró.
router.use(authenticateToken);

const profileSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  imageUrl: true,
  clientId: true,
  client: { select: { id: true, name: true, email: true, phone: true, address: true, imageUrl: true } },
} as const;

// GET /api/portal/my-profile
router.get('/my-profile', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: profileSelect });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const profileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  address: z.string().max(500).optional(),
  imageUrl: imageSchema.optional(),
});

// PUT /api/portal/my-profile
router.put('/my-profile', validateBody(profileSchema), async (req, res) => {
  try {
    const { userId, tenantId, clientId } = req.user!;
    const { name, email, phone, address, imageUrl } = req.body as z.infer<typeof profileSchema>;

    if (email) {
      const taken = await prisma.user.findFirst({ where: { tenantId, email, id: { not: userId } }, select: { id: true } });
      if (taken) return res.status(409).json({ error: 'Ese correo ya está en uso en este salón' });
    }

    await runInTransaction(async (tx) => {
      if (name !== undefined || email !== undefined || imageUrl !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(name !== undefined && { name }),
            ...(email !== undefined && { email }),
            ...(imageUrl !== undefined && { imageUrl }),
          },
        });
      }
      if (clientId && (phone !== undefined || address !== undefined || email !== undefined || imageUrl !== undefined || name !== undefined)) {
        await tx.client.update({
          where: { id: clientId },
          data: {
            ...(name !== undefined && { name }),
            ...(phone !== undefined && { phone }),
            ...(address !== undefined && { address }),
            ...(email !== undefined && { email }),
            ...(imageUrl !== undefined && { imageUrl }),
          },
        });
      }
    });

    res.json(await prisma.user.findUnique({ where: { id: userId }, select: profileSelect }));
  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
