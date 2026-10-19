import { addDaysISO, type Fen, type LocalizedText } from './types';

/**
 * Survival Simulator — deterministic 30-day daily cash forecast + what-if scenarios.
 *
 * MODEL (documented in docs/FINANCIAL_METHODOLOGY.md):
 *  - Inflows: daily sales of `dailySalesFen` reach the bank `settlementDelayDays`
 *    after the sale (platform payout lag). Day d receives the sales of day
 *    (d − delay) when d − delay ≥ 1. Days are 1-indexed from `asOfISO` + 1.
 *  - Explicit `extraInflows` (e.g. known pending settlements) land on their
 *    exact day and are NOT scaled by scenarios — they are known receipts.
 *  - Outflows: supplier obligations on their due day (overdue ⇒ day 1,
 *    they must be paid now), daily ad spend, daily fixed costs.
 *  - firstShortageDay = first day whose closing balance < 0, else null.
 *    A no-shortage result is EXPLICIT — never an invented date.
 *
 * DEMO CONSTANTS (tests + seed): opening ¥60,000; sales ¥6,000/day settling in
 * 5 days; supplier ¥40,000 due day 6 + ¥50,000 due day 12; ads ¥800/day ⇒
 * base never goes negative (min ¥2,400 on day 12);
 * STRESS (sales −20%, supplier +10%, payout +5d) ⇒ firstShortageDay = 12.
 */

export type AlertLevel = 'NONE' | 'WATCH' | 'WARNING' | 'CRITICAL';

export interface SupplierObligation {
  id: string;
  label: string;
  /** days from asOf; ≤0 means overdue and lands on day 1 */
  dueInDays: number;
  amountFen: Fen;
  status: 'DUE' | 'OVERDUE' | 'MISSING_DOC' | 'PAID';
}

export interface ScheduledFlow {
  id: string;
  label: string;
  dayOffset: number;
  amountFen: Fen;
}

export interface BaseForecastSpec {
  openingCashFen: Fen;
  /** ISO datetime of "today" — the forecast origin (passed in, never clocked) */
  asOfISO: string;
  horizonDays: number;
  /** average daily gross sales assumed to settle (fen/day) */
  dailySalesFen: Fen;
  /** platform payout lag in days */
  settlementDelayDays: number;
  supplierObligations: SupplierObligation[];
  adSpendPerDayFen: Fen;
  fixedCostsPerDayFen: Fen;
  extraInflows?: ScheduledFlow[];
  extraOutflows?: ScheduledFlow[];
}

export interface ScenarioParams {
  /** percent, clamped to −80..+200 */
  salesChangePct: number;
  /** percent, clamped to −80..+200 */
  supplierCostChangePct: number;
  /** additional payout delay days, clamped to 0..+60 */
  settlementDelayDays: number;
  /** percent, clamped to −80..+200 */
  adSpendChangePct: number;
}

export interface ForecastDay {
  day: number;
  dateISO: string;
  inflowFen: Fen;
  outflowFen: Fen;
  balanceFen: Fen;
}

export interface CashForecastResult {
  days: ForecastDay[];
  openingCashFen: Fen;
  minBalanceFen: Fen;
  minBalanceDay: number;
  firstShortageDay: number | null;
  firstShortageDateISO: string | null;
  totalInflowFen: Fen;
  totalOutflowFen: Fen;
  closingBalanceFen: Fen;
  alertLevel: AlertLevel;
  obligationsAtShortage: Array<{ id: string; label: string; amountFen: Fen; dueInDays: number }>;
  alertExplanation: LocalizedText;
  completeness: {
    supplierObligationsIncluded: number;
    missingDocCount: number;
    scheduledExtraInflowsFen: Fen;
    assumptions: LocalizedText[];
  };
}

export const CLAMPS = {
  percentMin: -80,
  percentMax: 200,
  delayMin: 0,
  delayMax: 60
} as const;

export function clampScenarioParams(raw: Partial<ScenarioParams>): ScenarioParams {
  const clampPct = (v: number | undefined): number =>
    Math.min(CLAMPS.percentMax, Math.max(CLAMPS.percentMin, Math.round(v ?? 0)));
  return {
    salesChangePct: clampPct(raw.salesChangePct),
    supplierCostChangePct: clampPct(raw.supplierCostChangePct),
    settlementDelayDays: Math.min(CLAMPS.delayMax, Math.max(CLAMPS.delayMin, Math.round(raw.settlementDelayDays ?? 0))),
    adSpendChangePct: clampPct(raw.adSpendChangePct)
  };
}

export function cashForecast(spec: BaseForecastSpec): CashForecastResult {
  const horizon = Math.max(1, Math.min(120, Math.round(spec.horizonDays)));
  const delay = Math.max(0, Math.round(spec.settlementDelayDays));
  const dailyOut = Math.max(0, Math.round(spec.adSpendPerDayFen)) + Math.max(0, Math.round(spec.fixedCostsPerDayFen));

  // bucket supplier obligations by day (overdue ⇒ day 1)
  const supplierByDay = new Map<number, Fen>();
  const obligationByDay = new Map<number, SupplierObligation[]>();
  let missingDocCount = 0;
  for (const ob of spec.supplierObligations) {
    if (ob.status === 'MISSING_DOC') missingDocCount += 1;
    if (ob.status === 'PAID') continue;
    const day = Math.max(1, Math.min(horizon, Math.round(ob.dueInDays) <= 0 ? 1 : Math.round(ob.dueInDays)));
    supplierByDay.set(day, (supplierByDay.get(day) ?? 0) + ob.amountFen);
    const list = obligationByDay.get(day) ?? [];
    list.push(ob);
    obligationByDay.set(day, list);
  }

  const extraIn = new Map<number, Fen>();
  let scheduledExtraFen = 0;
  for (const f of spec.extraInflows ?? []) {
    const day = Math.max(1, Math.min(horizon, Math.round(f.dayOffset)));
    extraIn.set(day, (extraIn.get(day) ?? 0) + f.amountFen);
    scheduledExtraFen += f.amountFen;
  }
  const extraOut = new Map<number, Fen>();
  for (const f of spec.extraOutflows ?? []) {
    const day = Math.max(1, Math.min(horizon, Math.round(f.dayOffset)));
    extraOut.set(day, (extraOut.get(day) ?? 0) + f.amountFen);
  }

  const days: ForecastDay[] = [];
  let balance = Math.round(spec.openingCashFen);
  let minBalanceFen = balance;
  let minBalanceDay = 0;
  let firstShortageDay: number | null = null;
  let totalInflow = 0;
  let totalOutflow = 0;

  for (let day = 1; day <= horizon; day++) {
    // sales settle with payout lag: today's receipt is the sale of day (day − delay)
    const salesDay = day - delay;
    const salesInflow = salesDay >= 1 ? Math.max(0, Math.round(spec.dailySalesFen)) : 0;
    const inflow = salesInflow + (extraIn.get(day) ?? 0);
    const outflow = dailyOut + (supplierByDay.get(day) ?? 0) + (extraOut.get(day) ?? 0);

    balance += inflow - outflow;
    totalInflow += inflow;
    totalOutflow += outflow;

    if (balance < minBalanceFen) {
      minBalanceFen = balance;
      minBalanceDay = day;
    }
    if (balance < 0 && firstShortageDay === null) {
      firstShortageDay = day;
    }

    days.push({
      day,
      dateISO: addDaysISO(spec.asOfISO, day),
      inflowFen: inflow,
      outflowFen: outflow,
      balanceFen: balance
    });
  }

  const alertLevel: AlertLevel =
    firstShortageDay !== null
      ? firstShortageDay <= 7
        ? 'CRITICAL'
        : 'WARNING'
      : minBalanceFen < dailyOut * 7
        ? 'WATCH'
        : 'NONE';

  const shortageDay = firstShortageDay ?? minBalanceDay;
  const obligationsAtShortage = (obligationByDay.get(shortageDay) ?? [])
    .map((o) => ({ id: o.id, label: o.label, amountFen: o.amountFen, dueInDays: o.dueInDays }))
    .concat(
      shortageDay > 0 && firstShortageDay !== null
        ? [...obligationByDay.entries()]
            .filter(([d]) => d <= shortageDay)
            .flatMap(([, list]) => list)
            .map((o) => ({ id: o.id, label: o.label, amountFen: o.amountFen, dueInDays: o.dueInDays }))
        : []
    )
    .filter((o, i, arr) => arr.findIndex((x) => x.id === o.id) === i)
    .sort((a, b) => a.dueInDays - b.dueInDays);

  const alertExplanation: LocalizedText =
    alertLevel === 'NONE'
      ? { en: 'No projected cash shortage within the forecast window.', zh: '预测期内未发现现金短缺。' }
      : alertLevel === 'WATCH'
        ? { en: 'No shortage projected, but the cash floor is thin — under one week of typical outflows.', zh: '虽无短缺预测，但现金底位偏薄——不足一周的常规支出。' }
        : alertLevel === 'WARNING'
          ? { en: `Projected cash shortage on day ${firstShortageDay}. Action window is open now.`, zh: `预计第 ${firstShortageDay} 天出现现金短缺。现在就是行动窗口。` }
          : { en: `Projected cash shortage within 7 days (day ${firstShortageDay}). Treat as urgent.`, zh: `预计 7 天内出现现金短缺（第 ${firstShortageDay} 天）。请紧急处理。` };

  return {
    days,
    openingCashFen: Math.round(spec.openingCashFen),
    minBalanceFen,
    minBalanceDay,
    firstShortageDay,
    firstShortageDateISO: firstShortageDay !== null ? addDaysISO(spec.asOfISO, firstShortageDay) : null,
    totalInflowFen: totalInflow,
    totalOutflowFen: totalOutflow,
    closingBalanceFen: balance,
    alertLevel,
    obligationsAtShortage,
    alertExplanation,
    completeness: {
      supplierObligationsIncluded: spec.supplierObligations.filter((o) => o.status !== 'PAID').length,
      missingDocCount,
      scheduledExtraInflowsFen: scheduledExtraFen,
      assumptions: [
        {
          en: 'Daily sales are modeled as a constant average; real sales vary by day and campaign.',
          zh: '每日销售按恒定均值建模；实际销售会按日和活动波动。'
        },
        {
          en: 'Supplier obligations land on their due day; overdue items are assumed paid immediately (day 1).',
          zh: '供应商应付款按到期日支付；逾期款项视为立即支付（第 1 天）。'
        },
        {
          en: missingDocCount > 0
            ? `${missingDocCount} supplier invoice(s) lack documentation — amounts are included but must be verified.`
            : 'All supplier invoices have documentation on file.',
          zh: missingDocCount > 0
            ? `${missingDocCount} 张供应商发票缺少单据——金额已计入，但需要核实。`
            : '所有供应商发票均有单据在档。'
        }
      ]
    }
  };
}

/** Stressed forecast = transformed spec → forecast. Deterministic, clamped.
 *
 *  Scheduled receipts (extraInflows = pending settlements of recent SALES) are
 *  stress-scaled too: they shrink with salesChangePct and shift out with
 *  settlementDelayDays — a sales slump delays and shrinks platform payouts. */
export function applyScenario(spec: BaseForecastSpec, rawParams: Partial<ScenarioParams>): CashForecastResult {
  const p = clampScenarioParams(rawParams);
  const salesFactor = 1 + p.salesChangePct / 100;
  const scaled: BaseForecastSpec = {
    ...spec,
    dailySalesFen: Math.round(spec.dailySalesFen * salesFactor),
    settlementDelayDays: spec.settlementDelayDays + p.settlementDelayDays,
    adSpendPerDayFen: Math.max(0, Math.round(spec.adSpendPerDayFen * (1 + p.adSpendChangePct / 100))),
    supplierObligations: spec.supplierObligations.map((o) => ({
      ...o,
      amountFen: Math.round(o.amountFen * (1 + p.supplierCostChangePct / 100))
    })),
    extraInflows: spec.extraInflows?.map((f) => ({
      ...f,
      dayOffset: f.dayOffset + p.settlementDelayDays,
      amountFen: Math.round(f.amountFen * salesFactor)
    }))
  };
  return cashForecast(scaled);
}

/**
 * DEMO BASE SPEC — the documented Ms. Li anchor used by seed + tests.
 * Day-12 invariant: stressed(sales −20%, supplier +10%, payout +5d) ⇒ day 12.
 */
export const DEMO_FORECAST_SPEC: BaseForecastSpec = {
  openingCashFen: 6_000_000, // ¥60,000
  asOfISO: '2026-01-01T00:00:00.000Z',
  horizonDays: 30,
  dailySalesFen: 600_000, // ¥6,000/day → ¥180,000 GMV over 30 days
  settlementDelayDays: 5,
  supplierObligations: [
    { id: 'demo-sup-1', label: 'Fabric supplier A', dueInDays: 6, amountFen: 4_000_000, status: 'DUE' },
    { id: 'demo-sup-2', label: 'Packaging supplier B', dueInDays: 12, amountFen: 5_000_000, status: 'DUE' }
  ],
  adSpendPerDayFen: 80_000, // ¥800/day
  fixedCostsPerDayFen: 0
};

export const DEMO_STRESS_PARAMS: ScenarioParams = {
  salesChangePct: -20,
  supplierCostChangePct: 10,
  settlementDelayDays: 5,
  adSpendChangePct: 0
};
