import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export interface AuditEntry {
  businessId: string;
  userId?: string | null;
  action: string; // REGISTER | LOGIN | LOGIN_FAILED | LOGOUT | DATA_ACCESS | SOURCE_REVOKE | IMPORT | APPROVAL_DECISION | ...
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
}

/**
 * Append-only, tamper-evident audit writer.
 *
 * Hash chain: hash = sha256(prevHash ‖ canonical JSON of this row). Writes for
 * one business are serialized through an in-process promise chain so the
 * prevHash lookup is race-free inside one instance. Multi-instance deployments
 * must serialize per business at the database level (advisory lock) — recorded
 * as residual risk R4 in docs/RISK_REGISTER.md.
 *
 * Fire-and-forget: a failed audit write never breaks the user request but is
 * always logged. Do NOT put PII (emails, names) into metadata.
 */
const chains = new Map<string, Promise<void>>();

function canonical(entry: AuditEntry, createdAt: Date): string {
  return JSON.stringify({
    businessId: entry.businessId,
    userId: entry.userId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    metadata: entry.metadata ?? null,
    ip: entry.ip ?? null,
    createdAt: createdAt.toISOString()
  });
}

function writeAudit(entry: AuditEntry): void {
  const previous = chains.get(entry.businessId) ?? Promise.resolve();
  const next = previous.then(async () => {
    const last = await prisma.auditLog.findFirst({
      where: { businessId: entry.businessId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { hash: true }
    });
    const createdAt = new Date();
    const prevHash = last?.hash ?? null;
    const hash = createHash('sha256').update(`${prevHash ?? 'GENESIS'}|${canonical(entry, createdAt)}`).digest('hex');
    await prisma.auditLog.create({
      data: {
        businessId: entry.businessId,
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ?? undefined,
        ip: entry.ip ?? null,
        createdAt,
        prevHash,
        hash
      }
    });
  });
  const stored = next.catch((err: unknown) => logger.error({ err, action: entry.action }, 'Failed to write audit log'));
  chains.set(entry.businessId, stored);
}

/** Verify the hash chain for a business — used by the audit API integrity check. */
export async function verifyAuditChain(businessId: string): Promise<{ valid: boolean; brokenAtId: string | null; rows: number }> {
  const rows = await prisma.auditLog.findMany({
    where: { businessId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      businessId: true,
      userId: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      ip: true,
      createdAt: true,
      prevHash: true,
      hash: true
    }
  });

  let prevHash: string | null = null;
  for (const row of rows) {
    const entry: AuditEntry = {
      businessId: row.businessId,
      userId: row.userId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata: row.metadata === null ? undefined : (row.metadata as Prisma.InputJsonValue),
      ip: row.ip
    };
    const expected: string = createHash('sha256').update(`${prevHash ?? 'GENESIS'}|${canonical(entry, row.createdAt)}`).digest('hex');
    if (row.hash !== expected || (row.prevHash ?? null) !== prevHash) {
      return { valid: false, brokenAtId: row.id, rows: rows.length };
    }
    prevHash = row.hash;
  }
  return { valid: true, brokenAtId: null, rows: rows.length };
}

export { writeAudit };
