import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { authenticatePlatformAdmin } from '../middleware/platformAuth';
import { config } from '../config';

/**
 * El cliente solo renueva la sesión ante un 401. Un token caducado o inválido debe dar 401
 * (con 403 el usuario veía «token inválido» cada 15 minutos hasta recargar la página).
 */
function run(middleware: (req: any, res: Response, next: () => void) => unknown, token: string) {
  return new Promise<{ status: number }>((resolve) => {
    const res = {
      status(code: number) {
        resolve({ status: code });
        return { json: () => undefined };
      },
    } as unknown as Response;
    middleware({ headers: { authorization: `Bearer ${token}` } } as Request, res, () => resolve({ status: 200 }));
  });
}

describe('token caducado o inválido', () => {
  it('salón: caducado → 401', async () => {
    const expired = jwt.sign({ userId: 'u', tenantId: 't' }, config.jwtSecret, { expiresIn: -10 });
    expect((await run(authenticateToken, expired)).status).toBe(401);
  });
  it('salón: firma incorrecta → 401', async () => {
    const forged = jwt.sign({ userId: 'u', tenantId: 't' }, 'otra-clave');
    expect((await run(authenticateToken, forged)).status).toBe(401);
  });
  it('plataforma: caducado → 401', async () => {
    const expired = jwt.sign({ scope: 'platform', platformAdminId: 'p' }, config.platformJwtSecret, { expiresIn: -10 });
    expect((await run(authenticatePlatformAdmin, expired)).status).toBe(401);
  });
});
