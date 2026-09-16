import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { PlatformRole } from '@prisma/client';

export interface PlatformAuthRequest extends Request {
  platformAdmin?: {
    id: string;
    email: string;
    role: PlatformRole;
  };
}

// JWT_SECRET separado del de los tenants: un token de plataforma nunca debe
// poder usarse en rutas de un salón, ni viceversa. Si no se define una
// secreta propia, cae al secreto general (solo aceptable en desarrollo).
const PLATFORM_JWT_SECRET = process.env.PLATFORM_JWT_SECRET || process.env.JWT_SECRET!;

export function signPlatformToken(admin: { id: string; email: string; role: PlatformRole }): string {
  return jwt.sign(
    { platformAdminId: admin.id, email: admin.email, role: admin.role, scope: 'platform' },
    PLATFORM_JWT_SECRET,
    { expiresIn: '12h' }
  );
}

export const authenticatePlatformAdmin = (req: PlatformAuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, PLATFORM_JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    const decodedAdmin = decoded as any;
    if (decodedAdmin.scope !== 'platform' || !decodedAdmin.platformAdminId) {
      // Un token de tenant (o cualquier otro) no lleva estas claims.
      return res.status(403).json({ error: 'Token no autorizado para el portal de plataforma' });
    }

    req.platformAdmin = {
      id: decodedAdmin.platformAdminId,
      email: decodedAdmin.email,
      role: decodedAdmin.role,
    };
    next();
  });
};

export const requireSuperAdmin = (req: PlatformAuthRequest, res: Response, next: NextFunction) => {
  if (!req.platformAdmin) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.platformAdmin.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Requiere rol de super administrador' });
  }

  next();
};
