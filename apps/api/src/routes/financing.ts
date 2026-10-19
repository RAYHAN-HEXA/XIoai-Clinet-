import { Router } from 'express';
import { financingMatcher, cashForecast, applyScenario, DEMO_STRESS_PARAMS, type FinancingReason } from '@xiaocai/engine';
import { buildBaseForecastSpec } from '../services/forecast-spec';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { writeAudit } from '../audit/audit';
import { asyncHandler } from '../lib/async';

export const financingRouter = Router();

financingRouter.get(
  '/options',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const spec = await buildBaseForecastSpec(user.businessId);
    const base = cashForecast(spec);

    // gap detection: base first, stressed second (the more urgent story wins)
    const stressed = applyScenario(spec, DEMO_STRESS_PARAMS);
    const target = base.firstShortageDay !== null ? base : stressed;
    const gap = {
      gapAmountFen: target.firstShortageDay !== null ? target.minBalanceFen : null,
      firstShortageDay: target.firstShortageDay
    };

    const pendingSettlements = await prisma.settlement.count({
      where: { businessId: user.businessId, status: 'PENDING' }
    });
    const reason: FinancingReason =
      pendingSettlements > 0 ? 'PAYOUT_DELAYED' : gap.firstShortageDay !== null ? 'SHORT_GAP' : 'PLANNED_EXPANSION';

    // a saved scenario can drive the gap instead (simulator "options" flow)
    const scenarioId = typeof req.query['scenarioId'] === 'string' ? req.query['scenarioId'] : undefined;
    let scenarioSummary: unknown = null;
    if (scenarioId) {
      const scenario = await prisma.scenario.findFirst({ where: { id: scenarioId, businessId: user.businessId } });
      if (scenario) {
        const result = applyScenario(spec, scenario.params as never);
        scenarioSummary = { id: scenario.id, name: scenario.name, result: { firstShortageDay: result.firstShortageDay, minBalanceFen: result.minBalanceFen } };
      }
    }

    writeAudit({
      businessId: user.businessId,
      userId: user.id,
      action: 'DATA_ACCESS',
      entityType: 'FINANCIAL',
      ip: req.ip,
      metadata: { endpoint: 'GET /api/financing/options', reason }
    });

    res.json({ gap, reason, scenario: scenarioSummary, ...financingMatcher({ gapAmountFen: gap.gapAmountFen, firstShortageDay: gap.firstShortageDay, reason }) });
  })
);
