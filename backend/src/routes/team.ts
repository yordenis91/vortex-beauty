import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../prismaClient';
import { runInTransaction } from '../lib/db';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/can';
import { validateBody } from '../middleware/validate';
import { generateTempPassword } from '../lib/tempPassword';
import { revokeAllSessions } from '../services/sessions';

/**
 * Equipo del salón: las cuentas con las que se entra al panel (dueño, gerentes y profesionales).
 * Solo el dueño las gestiona. La contraseña temporal se devuelve una única vez, al crear la
 * cuenta o al restablecerla; la persona la cambia luego en Mi perfil.
 */
const router = Router();
router.use(authenticateToken, requirePermission('team:manage'));

const select = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  professional: { select: { id: true, name: true } },
} as const;

const createSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
    email: z.string().trim().toLowerCase().email('Correo no válido'),
    role: z.enum(['ADMIN', 'STAFF']),
    // Un profesional (STAFF) entra a su propia agenda: debe tener ficha de profesional sin cuenta.
    professionalId: z.string().uuid().optional(),
  })
  .refine((b) => b.role !== 'STAFF' || !!b.professionalId, { message: 'Elige a qué profesional pertenece la cuenta', path: ['professionalId'] });

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().toLowerCase().email('Correo no válido').optional(),
  isActive: z.boolean().optional(),
});

const sameSalon = (req: { user?: { tenantId: string } }) => ({ tenantId: req.user!.tenantId });

// GET /api/team
router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { ...sameSalon(req), role: { in: ['OWNER', 'ADMIN', 'STAFF'] } },
      select,
      orderBy: [{ createdAt: 'asc' }],
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// POST /api/team
router.post('/', validateBody(createSchema), async (req, res) => {
  try {
    const { tenantId } = req.user!;
    const { name, email, role, professionalId } = req.body as z.infer<typeof createSchema>;
    const tempPassword = generateTempPassword();
    const password = await bcrypt.hash(tempPassword, 10);

    const created = await runInTransaction(async (tx) => {
      if (await tx.user.findFirst({ where: { tenantId, email }, select: { id: true } })) throw new Error('EMAIL_TAKEN');
      if (role === 'STAFF') {
        const pro = await tx.professional.findFirst({ where: { id: professionalId, tenantId }, select: { userId: true } });
        if (!pro) throw new Error('PRO_NOT_FOUND');
        if (pro.userId) throw new Error('PRO_HAS_ACCOUNT');
      }
      const user = await tx.user.create({ data: { tenantId, email, name, password, role } });
      if (role === 'STAFF') await tx.professional.update({ where: { id: professionalId }, data: { userId: user.id } });
      return tx.user.findUniqueOrThrow({ where: { id: user.id }, select });
    });
    res.status(201).json({ user: created, tempPassword });
  } catch (error: any) {
    if (error?.message === 'EMAIL_TAKEN') return res.status(409).json({ error: 'Ya existe un usuario con ese correo en este salón' });
    if (error?.message === 'PRO_NOT_FOUND') return res.status(400).json({ error: 'Profesional no encontrado' });
    if (error?.message === 'PRO_HAS_ACCOUNT') return res.status(409).json({ error: 'Ese profesional ya tiene una cuenta' });
    console.error('Error creating team user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/** Carga el miembro del equipo; el dueño no se modifica desde aquí. */
async function loadMember(req: any, res: any) {
  const member = await prisma.user.findFirst({
    where: { id: req.params.id, ...sameSalon(req), role: { in: ['OWNER', 'ADMIN', 'STAFF'] } },
    select: { id: true, role: true },
  });
  if (!member) {
    res.status(404).json({ error: 'Usuario no encontrado' });
    return null;
  }
  if (member.role === 'OWNER') {
    res.status(403).json({ error: 'La cuenta del dueño no se modifica desde aquí' });
    return null;
  }
  return member;
}

// PATCH /api/team/:id — nombre, correo y activar/desactivar
router.patch('/:id', validateBody(updateSchema), async (req, res) => {
  try {
    const member = await loadMember(req, res);
    if (!member) return;
    const { tenantId } = req.user!;
    const { name, email, isActive } = req.body as z.infer<typeof updateSchema>;

    if (email && (await prisma.user.findFirst({ where: { tenantId, email, id: { not: member.id } }, select: { id: true } }))) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo en este salón' });
    }
    const user = await runInTransaction(async (tx) => {
      await tx.user.update({ where: { id: member.id }, data: { ...(name && { name }), ...(email && { email }), ...(isActive !== undefined && { isActive }) } });
      // El nombre y el estado de la cuenta viajan con la ficha del profesional.
      await tx.professional.updateMany({
        where: { userId: member.id },
        data: { ...(name && { name }), ...(email && { email }), ...(isActive !== undefined && { isActive }) },
      });
      return tx.user.findUniqueOrThrow({ where: { id: member.id }, select });
    });
    if (isActive === false) await revokeAllSessions(member.id);
    res.json(user);
  } catch (error) {
    console.error('Error updating team user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// POST /api/team/:id/reset-password — contraseña temporal nueva; cierra sus sesiones
router.post('/:id/reset-password', async (req, res) => {
  try {
    const member = await loadMember(req, res);
    if (!member) return;
    const tempPassword = generateTempPassword();
    await prisma.user.update({ where: { id: member.id }, data: { password: await bcrypt.hash(tempPassword, 10) } });
    await revokeAllSessions(member.id);
    res.json({ tempPassword });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// DELETE /api/team/:id — solo cuentas sin historial; si no, se desactivan
router.delete('/:id', async (req, res) => {
  try {
    const member = await loadMember(req, res);
    if (!member) return;
    const { tenantId } = req.user!;
    const [clients, services] = await Promise.all([
      prisma.client.count({ where: { tenantId, userId: member.id } }),
      prisma.service.count({ where: { tenantId, userId: member.id } }),
    ]);
    if (clients + services > 0) {
      return res.status(409).json({ error: 'Esta cuenta tiene clientes o servicios registrados. Desactívala en lugar de eliminarla.' });
    }
    await prisma.user.delete({ where: { id: member.id } });
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error('Error deleting team user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
