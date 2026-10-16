import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma, { basePrisma } from '../prismaClient';
import { runWithTenant } from '../lib/tenantContext';
import { config } from '../config';

/**
 * Sesiones: access token JWT de 15 minutos (en memoria del navegador) más un
 * refresh token opaco en cookie httpOnly que se rota en cada renovación.
 *
 *  - Solo se guarda el hash SHA-256 del refresh token.
 *  - Reutilizar un token ya rotado indica robo: se revocan todas las sesiones de ese usuario.
 *  - Desactivar un usuario o suspender su salón corta la renovación; el acceso
 *    vigente dura como mucho 15 minutos más.
 */
export const REFRESH_COOKIE = 'vb_refresh';
const COOKIE_PATH = '/api/auth';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const newToken = () => randomBytes(48).toString('base64url');

export interface SessionUser {
  id: string;
  role: string;
  clientId: string | null;
  tenantId: string;
}

export function signAccessToken(user: SessionUser): string {
  return jwt.sign(
    { userId: user.id, role: user.role, clientId: user.clientId, tenantId: user.tenantId },
    config.jwtSecret,
    { expiresIn: config.accessTokenTtl }
  );
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function setRefreshCookie(res: Response, token: string) {
  const sameSite = config.cookieSameSite;
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    // 'none' exige Secure; en producción siempre Secure
    secure: config.isProduction || sameSite === 'none',
    sameSite,
    path: COOKIE_PATH,
    maxAge: config.refreshTtlDays * 24 * 3600 * 1000,
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
}

/** Crea una sesión nueva: devuelve el access token y deja la cookie de renovación. */
export async function startSession(req: Request, res: Response, user: SessionUser): Promise<string> {
  const refresh = newToken();
  await basePrisma.refreshToken.create({
    data: {
      tokenHash: hash(refresh),
      userId: user.id,
      tenantId: user.tenantId,
      expiresAt: new Date(Date.now() + config.refreshTtlDays * 24 * 3600 * 1000),
      userAgent: req.headers['user-agent']?.slice(0, 200),
      ip: req.ip,
    },
  });
  setRefreshCookie(res, refresh);
  // Limpieza oportunista de sesiones caducadas hace más de un día
  void basePrisma.refreshToken
    .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) } } })
    .catch(() => undefined);
  return signAccessToken(user);
}

export type RefreshResult =
  | { ok: true; accessToken: string; userId: string; tenantId: string }
  | { ok: false; reason: 'missing' | 'invalid' | 'expired' | 'reused' | 'inactive' };

/** Renueva la sesión a partir de la cookie: rota el refresh token y emite un access token nuevo. */
export async function refreshSession(req: Request, res: Response): Promise<RefreshResult> {
  const presented = readCookie(req, REFRESH_COOKIE);
  if (!presented) return { ok: false, reason: 'missing' };

  const record = await basePrisma.refreshToken.findUnique({ where: { tokenHash: hash(presented) } });
  if (!record) return { ok: false, reason: 'invalid' };

  if (record.revokedAt) {
    // Un token ya rotado o cerrado que reaparece: posible robo. Se cierran todas las sesiones del usuario.
    if (record.replacedBy) await revokeAllSessions(record.userId);
    return { ok: false, reason: 'reused' };
  }
  if (record.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };

  // User tiene RLS: se consulta dentro del contexto del salón de la sesión.
  const user = await runWithTenant(record.tenantId, () =>
    prisma.user.findUnique({
      where: { id: record.userId },
      select: { id: true, role: true, clientId: true, tenantId: true, isActive: true, tenant: { select: { status: true } } },
    })
  );
  if (!user || !user.isActive || user.tenant.status === 'SUSPENDED') {
    await basePrisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    return { ok: false, reason: 'inactive' };
  }

  const next = newToken();
  await basePrisma.$transaction([
    basePrisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date(), replacedBy: hash(next), lastUsedAt: new Date() } }),
    basePrisma.refreshToken.create({
      data: {
        tokenHash: hash(next),
        userId: record.userId,
        tenantId: record.tenantId,
        // La sesión conserva su vencimiento absoluto: no se alarga indefinidamente renovando.
        expiresAt: record.expiresAt,
        userAgent: req.headers['user-agent']?.slice(0, 200),
        ip: req.ip,
      },
    }),
  ]);
  setRefreshCookie(res, next);
  return { ok: true, accessToken: signAccessToken(user), userId: user.id, tenantId: user.tenantId };
}

/** Cierra la sesión de la cookie actual. */
export async function endSession(req: Request, res: Response): Promise<void> {
  const presented = readCookie(req, REFRESH_COOKIE);
  if (presented) {
    await basePrisma.refreshToken.updateMany({ where: { tokenHash: hash(presented), revokedAt: null }, data: { revokedAt: new Date() } });
  }
  clearRefreshCookie(res);
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await basePrisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
