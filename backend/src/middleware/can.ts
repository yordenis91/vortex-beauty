import { Request, Response, NextFunction } from 'express';
import prisma from '../prismaClient';

export type Role = 'OWNER' | 'ADMIN' | 'STAFF' | 'CLIENT';

/**
 * Permisos por rol. Es la única tabla de autorización del salón: las rutas
 * piden un permiso (`requirePermission('catalog:manage')`) en lugar de
 * comparar roles a mano.
 *
 * - OWNER: todo, incluido el plan y los usuarios.
 * - ADMIN: opera el salón (agenda, catálogo, clientes, ajustes), sin plan ni usuarios.
 * - STAFF: profesional; solo ve y gestiona SU propia agenda.
 * - CLIENT: cuenta de cliente final; solo usa las rutas del portal.
 */
export type Permission =
  | 'appointments:all' // ver y gestionar la agenda de todos
  | 'appointments:own' // ver y gestionar solo la propia agenda
  | 'customers:read'
  | 'customers:manage'
  | 'catalog:manage' // servicios, categorías, profesionales, recursos, galería
  | 'settings:manage' // horarios, días cerrados, ajustes de reserva
  | 'notifications:manage'
  | 'billing:manage' // plan del salón
  | 'team:manage'; // usuarios del salón

const ALL: Permission[] = [
  'appointments:all',
  'appointments:own',
  'customers:read',
  'customers:manage',
  'catalog:manage',
  'settings:manage',
  'notifications:manage',
  'billing:manage',
  'team:manage',
];

export const PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: ALL,
  ADMIN: ALL.filter((p) => p !== 'billing:manage' && p !== 'team:manage'),
  STAFF: ['appointments:own', 'customers:read'],
  CLIENT: [],
};

export function hasPermission(role: Role | undefined, permission: Permission): boolean {
  return !!role && PERMISSIONS[role]?.includes(permission);
}

/** Roles que usan el panel del salón (todos menos el cliente final). */
export const isStaffSide = (role: Role | undefined) => role === 'OWNER' || role === 'ADMIN' || role === 'STAFF';

export const requirePermission =
  (permission: Permission) => (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    }
    next();
  };

/**
 * Alcance de agenda del usuario: `{}` si ve todo el salón, o el profesional
 * al que está limitado si es STAFF. Si un STAFF no tiene profesional asociado,
 * no ve ninguna cita.
 */
export async function appointmentScope(req: Request): Promise<{ professionalId?: string; none?: boolean }> {
  const role = req.user!.role as Role;
  if (hasPermission(role, 'appointments:all')) return {};
  if (!hasPermission(role, 'appointments:own')) return { none: true };
  const professional = await prisma.professional.findFirst({
    where: { userId: req.user!.userId, tenantId: req.user!.tenantId },
    select: { id: true },
  });
  return professional ? { professionalId: professional.id } : { none: true };
}
