import { Router, type RequestHandler } from 'express';
import { trueProfit, profitDrivers } from '@xiaocai/engine';
import { getAuthorisedData } from '../services/authorized-data';
import { requireAuth } from '../middleware/auth';
import { writeAudit } from '../audit/audit';
import { asyncHandler } from '../lib/async';

export const profitRouter = Router();

/** Parses ?from&to (ISO dates). Defaults: current = last 30 days. */
function range(req: { query: Record<string, unknown> }, now: Date): { from: Date; to: Date } {
  const to = req.query['to'] ? new Date(String(req.query['to'])) : now;
  const from = req.query['from'] ? new Date(String(req.query['from'])) : new Date(now.getTime() - 30 * 86_400_000);
  return { from, to };
}

function auditRead(businessId: string, userId: string, ip: string | undefined, endpoint: string, extra: Record<string, unknown> = {}): void {
  writeAudit({
    businessId,
    userId,
    action: 'DATA_ACCESS',
    entityType: 'FINANCIAL',
    ip,
    metadata: { endpoint, ...extra }
  });
}

profitRouter.get(
  '/summary',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { from, to } = range(req, new Date());
    const data = await getAuthorisedData(user.businessId, { from, to });
    const result = trueProfit({ orders: data.orders, adSpend: data.adSpend, products: data.products });
    auditRead(user.businessId, user.id, req.ip, 'GET /api/profit/summary', { from: from.toISOString(), to: to.toISOString() });
    res.json({ range: { from: from.toISOString(), to: to.toISOString() }, ...result });
  })
);

function groupEndpoint(key: 'byProduct' | 'byCampaign' | 'byChannel'): RequestHandler {
  return asyncHandler(async (req, res) => {
    const user = req.user!;
    const { from, to } = range(req, new Date());
    const data = await getAuthorisedData(user.businessId, { from, to });
    const result = trueProfit({ orders: data.orders, adSpend: data.adSpend, products: data.products });
    auditRead(user.businessId, user.id, req.ip, `GET /api/profit/${key}`, { from: from.toISOString(), to: to.toISOString() });
    res.json({ range: { from: from.toISOString(), to: to.toISOString() }, groups: result[key], meta: result.meta });
  });
}

profitRouter.get('/by-product', requireAuth, groupEndpoint('byProduct'));
profitRouter.get('/by-campaign', requireAuth, groupEndpoint('byCampaign'));
profitRouter.get('/by-channel', requireAuth, groupEndpoint('byChannel'));

profitRouter.get(
  '/drivers',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const now = new Date();
    const current = range(req, now);
    // previous period defaults to the same length immediately before `from`;
    // callers may pin both windows explicitly (prevFrom/prevTo) for a
    // like-for-like comparison of two chosen reporting periods.
    const spanMs = current.to.getTime() - current.from.getTime();
    const previous = req.query['prevFrom'] || req.query['prevTo']
      ? {
          from: req.query['prevFrom'] ? new Date(String(req.query['prevFrom'])) : new Date(current.from.getTime() - spanMs - 86_400_000),
          to: req.query['prevTo'] ? new Date(String(req.query['prevTo'])) : new Date(current.from.getTime() - 86_400_000)
        }
      : {
          from: new Date(current.from.getTime() - spanMs - 86_400_000),
          to: new Date(current.from.getTime() - 86_400_000)
        };
    const [cur, prev] = await Promise.all([
      getAuthorisedData(user.businessId, current),
      getAuthorisedData(user.businessId, previous)
    ]);
    const result = profitDrivers(
      { orders: cur.orders, adSpend: cur.adSpend, products: cur.products },
      { orders: prev.orders, adSpend: prev.adSpend, products: prev.products }
    );
    auditRead(user.businessId, user.id, req.ip, 'GET /api/profit/drivers', { from: current.from.toISOString(), to: current.to.toISOString() });
    res.json({ current: current, previous, ...result });
  })
);
