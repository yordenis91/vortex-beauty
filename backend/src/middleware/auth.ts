import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { basePrisma } from '../prismaClient';
import { config } from '../config';
import { runWithTenant } from '../lib/tenantContext';

type TenantStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED';

// Estado del salón en memoria unos segundos: evita una consulta por petición
// y aun así hace que una suspensión surta efecto casi de inmediato.
const STATUS_TTL_MS = 15_000;
const statusCache = new Map<string, { status: TenantStatus | null; expires: number }>();

export function invalidateTenantStatus(tenantId?: string) {
  if (tenantId) statusCache.delete(tenantId);
  else statusCache.clear();
}

async function getTenantStatus(tenantId: string): Promise<TenantStatus | null> {
  const cached = statusCache.get(tenantId);
  if (cached && cached.expires > Date.now()) return cached.status;
  const tenant = await basePrisma.tenant.findUnique({ where: { id: tenantId }, select: { status: true } });
  const status = tenant?.status ?? null;
  statusCache.set(tenantId, { status, expires: Date.now() + STATUS_TTL_MS });
  return status;
}

/**
 * Verifica el JWT del salón, comprueba que el salón siga activo y ejecuta el
 * resto de la petición dentro del contexto de tenant (ver lib/tenantContext).
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  if (!decoded.tenantId) {
    return res.status(401).json({ error: 'Token sin salón asociado. Vuelve a iniciar sesión.' });
  }

  try {
    const status = await getTenantStatus(decoded.tenantId);
    if (!status) {
      return res.status(401).json({ error: 'El salón de esta sesión ya no existe.' });
    }
    if (status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Este salón está suspendido. Contacta a soporte.' });
    }
  } catch (error) {
    return next(error);
  }

  req.userId = decoded.userId;
  req.user = {
    userId: decoded.userId,
    role: decoded.role || 'CLIENT',
    clientId: decoded.clientId,
    tenantId: decoded.tenantId,
  };
  runWithTenant(decoded.tenantId, () => next());
};

/**
 * Middleware para verificar que el usuario administra el salón (OWNER o ADMIN).
 * Debe ser utilizado DESPUÉS de authenticateToken. Para permisos más finos
 * (p. ej. el profesional STAFF) ver middleware/can.ts.
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};
