import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

interface AuthRequest extends Request {
  userId?: string;
  user?: {
    userId: string;
    role: 'ADMIN' | 'CLIENT';
    clientId?: string;
    tenantId: string;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    const decodedUser = decoded as any;
    if (!decodedUser.tenantId) {
      // Tokens emitidos antes del soporte multitenant no llevan tenantId.
      return res.status(401).json({ error: 'Token sin salón asociado. Vuelve a iniciar sesión.' });
    }
    req.userId = decodedUser.userId;
    req.user = {
      userId: decodedUser.userId,
      role: decodedUser.role || 'CLIENT',
      clientId: decodedUser.clientId,
      tenantId: decodedUser.tenantId,
    };
    next();
  });
};

/**
 * Middleware para verificar que el usuario es ADMIN
 * Debe ser utilizado DESPUÉS de authenticateToken
 */
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};