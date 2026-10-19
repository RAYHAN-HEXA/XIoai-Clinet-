import { Router } from 'express';
import { dailyBriefData } from '@xiaocai/engine';
import { getAuthorisedData } from '../services/authorized-data';
import { buildBaseForecastSpec } from '../services/forecast-spec';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { writeAudit } from '../audit/audit';
import { asyncHandler } from '../lib/async';

export const briefRouter = Router();

briefRouter.get(
  '/daily',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const lang = req.query['lang'] === 'zh' ? 'zh' : 'en';
    const now = new Date();
    const from = new Date(now.getTime() - 14 * 86_400_000);

    const [data, forecastSpec, pendingApprovals] = await Promise.all([
      getAuthorisedData(user.businessId, { from, to: now }),
      buildBaseForecastSpec(user.businessId, now),
      prisma.approval.findMany({
        where: { status: 'PENDING', recommendation: { businessId: user.businessId } },
        include: { recommendation: { select: { id: true, title: true } } },
        orderBy: { recommendation: { createdAt: 'desc' } }
      })
    ]);

    const brief = dailyBriefData({
      asOfISO: now.toISOString(),
      supplierInvoices: data.supplierInvoices,
      orders: data.orders,
      adSpend: data.adSpend,
      products: data.products,
      forecastSpec,
      approvalsPending: pendingApprovals.map((a) => ({ id: a.recommendation.id, title: a.recommendation.title }))
    });

    writeAudit({
      businessId: user.businessId,
      userId: user.id,
      action: 'DATA_ACCESS',
      entityType: 'FINANCIAL',
      ip: req.ip,
      metadata: { endpoint: 'GET /api/brief/daily' }
    });

    res.json({ lang, isDemo: user.business.isDemo, brief });
  })
);
