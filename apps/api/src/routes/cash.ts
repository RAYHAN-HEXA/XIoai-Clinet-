import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { applyScenario, cashForecast, DEMO_STRESS_PARAMS, type CashForecastResult } from '@xiaocai/engine';
import { buildBaseForecastSpec } from '../services/forecast-spec';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { writeAudit } from '../audit/audit';
import { asyncHandler } from '../lib/async';

export const cashRouter = Router();

const scenarioSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  params: z.object({
    salesChangePct: z.number().min(-95).max(500),
    supplierCostChangePct: z.number().min(-95).max(500),
    settlementDelayDays: z.number().min(-30).max(120),
    adSpendChangePct: z.number().min(-95).max(500)
  })
});

function auditRead(businessId: string, userId: string, ip: string | undefined, endpoint: string, extra: Record<string, unknown> = {}): void {
  writeAudit({ businessId, userId, action: 'DATA_ACCESS', entityType: 'FINANCIAL', ip, metadata: { endpoint, ...extra } });
}

/** Persisted summary: keep it small — the full daily curve is recomputable. */
function summarize(r: CashForecastResult): Prisma.InputJsonValue {
  return {
    firstShortageDay: r.firstShortageDay,
    minBalanceFen: r.minBalanceFen,
    minBalanceDay: r.minBalanceDay,
    closingBalanceFen: r.closingBalanceFen,
    alertLevel: r.alertLevel
  };
}

cashRouter.get(
  '/forecast',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const spec = await buildBaseForecastSpec(user.businessId);
    const base = cashForecast(spec);
    const stressed = applyScenario(spec, DEMO_STRESS_PARAMS);
    auditRead(user.businessId, user.id, req.ip, 'GET /api/cash/forecast');
    res.json({ spec, base, stressed, stressParams: DEMO_STRESS_PARAMS });
  })
);

/** Slider-driven live recompute — same engine, nothing persisted. */
cashRouter.post(
  '/preview',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const body = scenarioSchema.parse(req.body);
    const spec = await buildBaseForecastSpec(user.businessId);
    const base = cashForecast(spec);
    const result = applyScenario(spec, body.params);
    auditRead(user.businessId, user.id, req.ip, 'POST /api/cash/preview');
    res.json({ base, result });
  })
);

cashRouter.post(
  '/scenario',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const body = scenarioSchema.parse(req.body);
    const spec = await buildBaseForecastSpec(user.businessId);
    const result = applyScenario(spec, body.params);

    const saved = await prisma.scenario.create({
      data: {
        businessId: user.businessId,
        name: body.name ?? 'Scenario',
        params: body.params as unknown as Prisma.InputJsonValue,
        result: summarize(result)
      }
    });
    writeAudit({
      businessId: user.businessId,
      userId: user.id,
      action: 'SCENARIO_SAVED',
      entityType: 'SCENARIO',
      entityId: saved.id,
      ip: req.ip,
      metadata: { params: body.params }
    });
    res.status(201).json({ scenario: saved, result });
  })
);

cashRouter.get(
  '/scenarios',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const scenarios = await prisma.scenario.findMany({
      where: { businessId: user.businessId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    auditRead(user.businessId, user.id, req.ip, 'GET /api/cash/scenarios');
    res.json({ scenarios });
  })
);

cashRouter.get(
  '/alerts',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const spec = await buildBaseForecastSpec(user.businessId);
    const base = cashForecast(spec);
    auditRead(user.businessId, user.id, req.ip, 'GET /api/cash/alerts');
    res.json({
      alertLevel: base.alertLevel,
      firstShortageDay: base.firstShortageDay,
      firstShortageDateISO: base.firstShortageDateISO,
      minBalanceFen: base.minBalanceFen,
      explanation: base.alertExplanation,
      obligationsAtShortage: base.obligationsAtShortage,
      completeness: base.completeness
    });
  })
);
