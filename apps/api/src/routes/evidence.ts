import { Router } from 'express';
import { z } from 'zod';
import { buildEvidenceTree } from '@xiaocai/engine';
import { getAuthorisedData } from '../services/authorized-data';
import { requireAuth } from '../middleware/auth';
import { writeAudit } from '../audit/audit';
import { asyncHandler } from '../lib/async';

export const evidenceRouter = Router();

const metricSchema = z.enum(['revenue', 'realProfit', 'productCost', 'advertising', 'influencerCommission', 'delivery', 'refunds', 'platformFees']);

evidenceRouter.get(
  '/:metric',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const metric = metricSchema.safeParse(req.params['metric']);
    if (!metric.success) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'unknown metric' });
      return;
    }
    const now = new Date();
    const from = req.query['from'] ? new Date(String(req.query['from'])) : new Date(now.getTime() - 30 * 86_400_000);
    const to = req.query['to'] ? new Date(String(req.query['to'])) : now;
    const data = await getAuthorisedData(user.businessId, { from, to });
    const tree = buildEvidenceTree({
      metric: metric.data,
      orders: data.orders,
      adSpend: data.adSpend,
      products: data.products,
      supplierInvoices: data.supplierInvoices,
      periodLabel: `${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`
    });
    writeAudit({
      businessId: user.businessId,
      userId: user.id,
      action: 'DATA_ACCESS',
      entityType: 'FINANCIAL',
      ip: req.ip,
      metadata: { endpoint: `GET /api/evidence/${metric.data}`, from: from.toISOString(), to: to.toISOString() }
    });
    res.json({ from: from.toISOString(), to: to.toISOString(), ...tree });
  })
);
