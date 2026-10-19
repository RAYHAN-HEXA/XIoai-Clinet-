import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export interface AuditEntry {
  businessId: string;
  userId?: string | null;
  action: string; // REGISTER | LOGIN | LOGIN_FAILED | LOGOUT | DATA_ACCESS | ...
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
}

/**
 * Append-only audit writer. Fire-and-forget: a failed audit write must never
 * break the user request, but it must be visible in the logs.
 * Do NOT put PII (emails, names) into metadata.
 */
export function writeAudit(entry: AuditEntry): void {
  prisma.auditLog
    .create({
      data: {
        businessId: entry.businessId,
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ?? undefined,
        ip: entry.ip ?? null
      }
    })
    .catch((err: unknown) => logger.error({ err, action: entry.action }, 'Failed to write audit log'));
}
