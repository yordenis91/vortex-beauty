import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authenticatePlatformAdmin, signPlatformToken, PlatformAuthRequest } from '../middleware/platformAuth';
import { logAudit } from '../services/auditLogService';

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// No hay registro público de PlatformAdmin: se crean por seed o a mano por
// un super admin existente (fuera del alcance de este primer entregable).
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const admin = await prisma.platformAdmin.findUnique({ where: { email } });
    if (!admin || !admin.isActive) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const validPassword = await bcrypt.compare(password, admin.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const token = signPlatformToken({ id: admin.id, email: admin.email, role: admin.role });

    await logAudit({
      actorType: 'PLATFORM_ADMIN',
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'platform_admin.login',
      ip: req.ip,
    });

    res.json({
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
      token,
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error en login de plataforma:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/me', authenticatePlatformAdmin, async (req: PlatformAuthRequest, res) => {
  try {
    const admin = await prisma.platformAdmin.findUnique({
      where: { id: req.platformAdmin!.id },
      select: { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true },
    });

    if (!admin || !admin.isActive) {
      return res.status(401).json({ error: 'Cuenta no encontrada o inactiva' });
    }

    res.json({ admin });
  } catch (error) {
    console.error('Error obteniendo perfil de plataforma:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
