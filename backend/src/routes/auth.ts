import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma, { basePrisma } from '../prismaClient';
import { runInTransaction } from '../lib/db';
import { runWithTenant } from '../lib/tenantContext';
import { config } from '../config';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Respuesta única para cualquier fallo de credenciales: no revela si el salón,
// el email o la contraseña eran los incorrectos.
const INVALID_CREDENTIALS = { error: 'Credenciales inválidas' };

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  // Slug del salón (viene de la URL pública /:tenantSlug/register).
  tenantSlug: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  // Slug del salón (viene de la URL /:tenantSlug/login).
  tenantSlug: z.string().min(1),
});

function signToken(user: { id: string; role: string; clientId: string | null }, tenantId: string) {
  return jwt.sign(
    { userId: user.id, role: user.role, clientId: user.clientId, tenantId },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

// El salón se resuelve por slug en la tabla Tenant (sin RLS) y a partir de ahí
// todo corre dentro del contexto de ese salón.
async function findActiveTenant(slug: string) {
  const tenant = await basePrisma.tenant.findUnique({ where: { slug }, select: { id: true, status: true } });
  if (!tenant || tenant.status === 'SUSPENDED') return null;
  return tenant;
}

// Register (clienta nueva de un salón)
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, tenantSlug } = registerSchema.parse(req.body);

    const tenant = await findActiveTenant(tenantSlug);
    if (!tenant) {
      return res.status(404).json({ error: 'Salón no encontrado o no disponible' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await runWithTenant(tenant.id, async () => {
      const existingUser = await prisma.user.findUnique({
        where: { tenantId_email: { tenantId: tenant.id, email } },
        select: { id: true },
      });
      if (existingUser) return null;

      return runInTransaction(async (tx) => {
        // Client.userId es obligatorio en el schema: el admin de ESE salón.
        const adminUser = await tx.user.findFirst({ where: { role: 'ADMIN', tenantId: tenant.id } });
        if (!adminUser) {
          throw new Error('El salón no tiene un administrador');
        }

        const newClient = await tx.client.upsert({
          where: { tenantId_email: { tenantId: tenant.id, email } },
          update: { name },
          create: { name, email, userId: adminUser.id, tenantId: tenant.id },
        });

        return tx.user.create({
          data: { email, password: hashedPassword, name, role: 'CLIENT', clientId: newClient.id, tenantId: tenant.id },
          select: { id: true, email: true, name: true, role: true, clientId: true },
        });
      });
    });

    if (!result) {
      return res.status(400).json({ error: 'Ya existe una cuenta con ese email en este salón' });
    }

    res.json({ user: result, token: signToken(result, tenant.id) });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    console.error(error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Login (siempre dentro de un salón)
router.post('/login', async (req, res) => {
  try {
    const { email, password, tenantSlug } = loginSchema.parse(req.body);

    const tenant = await findActiveTenant(tenantSlug);
    if (!tenant) {
      // Se compara igualmente para que el tiempo de respuesta no delate si el salón existe.
      await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');
      return res.status(400).json(INVALID_CREDENTIALS);
    }

    const user = await runWithTenant(tenant.id, () =>
      prisma.user.findUnique({
        where: { tenantId_email: { tenantId: tenant.id, email } },
        select: { id: true, email: true, name: true, password: true, role: true, clientId: true, imageUrl: true },
      })
    );

    const isValidPassword = user ? await bcrypt.compare(password, user.password) : false;
    if (!user || !isValidPassword) {
      return res.status(400).json(INVALID_CREDENTIALS);
    }

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, clientId: user.clientId },
      token: signToken(user, tenant.id),
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, email: true, name: true, role: true, clientId: true, imageUrl: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
