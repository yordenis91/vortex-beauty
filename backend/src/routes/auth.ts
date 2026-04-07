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
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Usar transacción para crear Client y User de forma atómica
    const { user } = await prisma.$transaction(async (tx) => {
      // Buscar usuario administrador
      const adminUser = await tx.user.findFirst({
        where: { role: 'ADMIN' }
      });
      
      if (!adminUser) {
        throw new Error('No admin user found to assign as client owner');
      }
      
      // Crear registro en Client
      const newClient = await tx.client.create({
        data: {
          name,
          email,
          type: 'CUSTOMER',
          userId: adminUser.id, // Vinculado al admin
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
        },
        select: { id: true, email: true, name: true, role: true, clientId: true },
      });
      
      return { user: newUser };
    });

    const token = jwt.sign(
      { 
        userId: user.id,
        role: user.role,
        clientId: user.clientId,
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
      },
    });
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { 
        userId: user.id,
        role: user.role,
        clientId: user.clientId,
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