import prisma from '../prismaClient';
import { AuditActorType, Prisma } from '@prisma/client';

interface LogAuditParams {
  actorType: AuditActorType;
  actorId: string;
  actorEmail?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  tenantId?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
}

/**
 * Registra una entrada de auditoría a nivel de plataforma. Nunca debe
 * bloquear la operación que audita: si falla el registro, se loguea el error
 * y se sigue, en vez de propagar la excepción al llamador.
 */
export async function logAudit(params: LogAuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: params.actorType,
        actorId: params.actorId,
        actorEmail: params.actorEmail ?? undefined,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        tenantId: params.tenantId,
        metadata: params.metadata,
        ip: params.ip ?? undefined,
      },
    });
  } catch (error) {
    console.error('Error writing audit log:', error);
  }
}
