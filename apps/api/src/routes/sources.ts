import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { writeAudit } from '../audit/audit';
import { asyncHandler } from '../lib/async';

export const sourcesRouter = Router();

const statusSchema = z.object({
  status: z.enum(['GRANTED', 'REVOKED'])
});
const permissionSchema = z.object({
  permission: z.enum(['READ_ONLY', 'READ_WRITE'])
});

// All roles may VIEW sources; only OWNER may grant/revoke or change tiers.
sourcesRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    writeAudit({
      businessId: user.businessId,
      userId: user.id,
      action: 'DATA_ACCESS',
      entityType: 'DATA_SOURCES',
      ip: req.ip,
      metadata: { endpoint: 'GET /api/sources' }
    });
    const sources = await prisma.dataSource.findMany({
      where: { businessId: user.businessId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }]
    });
    const withCounts = await Promise.all(
      sources.map(async (s) => ({
        ...s,
        linkedOrders: await prisma.order.count({ where: { sourceId: s.id } }),
        linkedAds: await prisma.adSpend.count({ where: { sourceId: s.id } })
      }))
    );
    res.json({ sources: withCounts });
  })
);

sourcesRouter.post(
  '/:id/status',
  requireAuth,
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const body = statusSchema.parse(req.body);
    const source = await prisma.dataSource.findFirst({
      where: { id: req.params['id'], businessId: user.businessId }
    });
    if (!source) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    const updated = await prisma.dataSource.update({
      where: { id: source.id },
      data: {
        status: body.status,
        revokedAt: body.status === 'REVOKED' ? new Date() : null
      }
    });
    writeAudit({
      businessId: user.businessId,
      userId: user.id,
      action: body.status === 'REVOKED' ? 'SOURCE_REVOKE' : 'SOURCE_GRANT',
      entityType: 'DATA_SOURCE',
      entityId: source.id,
      ip: req.ip,
      metadata: { name: source.name, type: source.type }
    });
    res.json({ source: updated });
  })
);

sourcesRouter.post(
  '/:id/permission',
  requireAuth,
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const body = permissionSchema.parse(req.body);
    const source = await prisma.dataSource.findFirst({
      where: { id: req.params['id'], businessId: user.businessId }
    });
    if (!source) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    const updated = await prisma.dataSource.update({
      where: { id: source.id },
      data: { permission: body.permission }
    });
    writeAudit({
      businessId: user.businessId,
      userId: user.id,
      action: 'SOURCE_PERMISSION',
      entityType: 'DATA_SOURCE',
      entityId: source.id,
      ip: req.ip,
      metadata: { permission: body.permission }
    });
    res.json({ source: updated });
  })
);
