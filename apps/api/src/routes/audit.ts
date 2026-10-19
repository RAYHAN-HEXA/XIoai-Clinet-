import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { verifyAuditChain, writeAudit } from '../audit/audit';
import { requireAuth, requireRole } from '../middleware/auth';
import { sanitizeCsvCell } from '../services/csv';
import { asyncHandler } from '../lib/async';

export const auditRouter = Router();

/** Audit history is OWNER/ACCOUNTANT only; every viewer request is rejected here. */
auditRouter.use(requireAuth, requireRole('OWNER', 'ACCOUNTANT'));

const MAX_PAGE_SIZE = 100;

auditRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const page = Math.max(1, Number(req.query['page'] ?? 1) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query['pageSize'] ?? 50) || 50));
    const action = typeof req.query['action'] === 'string' && req.query['action'] !== '' ? req.query['action'] : undefined;
    const from = typeof req.query['from'] === 'string' && req.query['from'] !== '' ? new Date(req.query['from']) : undefined;
    const to = typeof req.query['to'] === 'string' && req.query['to'] !== '' ? new Date(req.query['to']) : undefined;

    const where = {
      businessId: user.businessId,
      ...(action ? { action } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {})
    };
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.auditLog.count({ where })
    ]);
    res.json({ rows, total, page, pageSize });
  })
);

auditRouter.get(
  '/integrity',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    res.json(await verifyAuditChain(user.businessId));
  })
);

auditRouter.get(
  '/export.csv',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const rows = await prisma.auditLog.findMany({
      where: { businessId: user.businessId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 10_000
    });

    const esc = (value: unknown): string => sanitizeCsvCell(String(value ?? ''));
    const header = 'createdAt,action,entityType,entityId,ip,prevHash,hash';
    const body = rows
      .map((r) =>
        [
          r.createdAt.toISOString(),
          esc(r.action),
          esc(r.entityType),
          esc(r.entityId),
          esc(r.ip),
          esc(r.prevHash),
          esc(r.hash)
        ].join(',')
      )
      .join('\n');

    writeAudit({
      businessId: user.businessId,
      userId: user.id,
      action: 'AUDIT_EXPORT',
      entityType: 'AUDIT',
      ip: undefined,
      metadata: { rows: rows.length }
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="xiaocai-audit-${Date.now()}.csv"`);
    res.send(`${header}\n${body}`);
  })
);
