import express from 'express';
import { zodResponse } from '../lib/validation';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma, { basePrisma } from '../prismaClient';
import { runInTransaction } from '../lib/db';
import { runWithTenant } from '../lib/tenantContext';
import { endSession, refreshSession, revokeAllSessions, startSession, clearRefreshCookie } from '../services/sessions';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Respuesta única para cualquier fallo de credenciales: no revela si el salón,
// el email o la contraseña eran los incorrectos.
const INVALID_CREDENTIALS = { error: 'Credenciales inválidas' };

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  // Slug del salón (viene de la URL /:tenantSlug/login).
  tenantSlug: z.string().min(1),
});

// El salón se resuelve por slug en la tabla Tenant (sin RLS) y a partir de ahí
// todo corre dentro del contexto de ese salón.
async function findActiveTenant(slug: string) {
  const tenant = await basePrisma.tenant.findUnique({ where: { slug }, select: { id: true, status: true } });
  if (!tenant || tenant.status === 'SUSPENDED') return null;
  return tenant;
}

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
        select: { id: true, email: true, name: true, password: true, role: true, clientId: true, imageUrl: true, isActive: true },
      })
    );

    const isValidPassword = user ? await bcrypt.compare(password, user.password) : false;
    if (!user || !isValidPassword || !user.isActive) {
      return res.status(400).json(INVALID_CREDENTIALS);
    }

    const token = await startSession(req, res, { id: user.id, role: user.role, clientId: user.clientId, tenantId: tenant.id });
    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, clientId: user.clientId },
      token,
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json(zodResponse(error));
    }
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Las rutas que usan la cookie exigen una cabecera propia: un formulario de otro sitio no puede
// enviarla, y una petición XHR con ella obliga a pasar por la verificación CORS (defensa CSRF).
const requireAjax: express.RequestHandler = (req, res, next) => {
  if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
    return res.status(400).json({ error: 'Petición no válida' });
  }
  next();
};

// Renueva la sesión con la cookie httpOnly (rota el refresh token)
router.post('/refresh', requireAjax, async (req, res) => {
  try {
    const result = await refreshSession(req, res);
    if (!result.ok) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Sesión no válida', reason: result.reason });
    }
    const user = await runWithTenant(result.tenantId, () =>
      prisma.user.findUnique({
        where: { id: result.userId },
        select: { id: true, email: true, name: true, role: true, clientId: true, imageUrl: true },
      })
    );
    res.json({ user, token: result.accessToken });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Cierra la sesión actual
router.post('/logout', requireAjax, async (req, res) => {
  try {
    await endSession(req, res);
    res.json({ ok: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
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

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Escribe tu contraseña actual'),
  newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres').max(200),
});

// Cambiar la propia contraseña (también la temporal que entrega el alta de un salón).
// Cierra las demás sesiones del usuario y deja abierta esta con credenciales nuevas.
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const { userId, tenantId, role, clientId } = req.user!;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true, isActive: true } });
    if (!user || !user.isActive || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ error: 'La contraseña actual no es correcta' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'La nueva contraseña debe ser distinta de la actual' });
    }

    await prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(newPassword, 10) } });
    await revokeAllSessions(userId);
    const token = await startSession(req, res, { id: userId, role, clientId: clientId ?? null, tenantId });
    res.json({ token });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json(zodResponse(error));
    }
    console.error('Error cambiando la contraseña:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
