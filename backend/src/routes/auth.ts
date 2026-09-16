import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  // Slug del salón en el que se está registrando (viene de la URL pública
  // /:tenantSlug/register). Opcional por retrocompatibilidad mientras el
  // frontend termina de migrar a esa página; si no llega, se usa el
  // comportamiento legacy (el primer admin encontrado).
  tenantSlug: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, tenantSlug } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { status: true } });
      if (!tenant || tenant.status === 'SUSPENDED') {
        return res.status(404).json({ error: 'Salón no encontrado o no disponible' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Usar transacción para crear Client y User de forma atómica
    const { user, tenantId } = await prisma.$transaction(async (tx) => {
      // Con tenantSlug (viene de /:tenantSlug/register): el admin de ESE
      // salón. Sin tenantSlug: comportamiento legacy (el primer admin
      // encontrado), que se mantiene solo por retrocompatibilidad mientras
      // el frontend termina de migrar a la página con slug.
      const adminUser = tenantSlug
        ? await tx.user.findFirst({ where: { role: 'ADMIN', tenant: { slug: tenantSlug } } })
        : await tx.user.findFirst({ where: { role: 'ADMIN' } });

      if (!adminUser || !adminUser.tenantId) {
        throw new Error('No admin user found to assign as client owner');
      }

      // Crear registro en Client
      const newClient = await tx.client.create({
        data: {
          name,
          email,
          type: 'CUSTOMER',
          userId: adminUser.id, // Vinculado al admin
          tenantId: adminUser.tenantId,
        }
      });

      // Crear registro en User con clientId del nuevo cliente
      const newUser = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'CLIENT',
          clientId: newClient.id, // Vinculado al cliente creado
          tenantId: adminUser.tenantId,
        },
        select: { id: true, email: true, name: true, role: true, clientId: true, tenantId: true },
      });

      return { user: newUser, tenantId: adminUser.tenantId };
    });

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        clientId: user.clientId,
        tenantId,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({ user, token });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    
    console.error(error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        clientId: true,
        imageUrl: true,
        tenantId: true,
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (!user.tenantId) {
      return res.status(400).json({ error: 'Esta cuenta no tiene un salón asociado. Contacta a soporte.' });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        clientId: user.clientId,
        tenantId: user.tenantId,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name,
        role: user.role,
        clientId: user.clientId,
      },
      token,
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    
    console.error('Login error:', error);
    return res.status(500).json({ 
      error: "Error interno del servidor",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: (req as any).userId },
      select: { 
        id: true, 
        email: true, 
        name: true,
        role: true,
        clientId: true,
        imageUrl: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;