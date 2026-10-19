import { describe, expect, it } from 'vitest';
import {
  DEMO_FORECAST_SPEC,
  DEMO_STRESS_PARAMS,
  applyScenario,
  cashForecast,
  clampScenarioParams,
  type BaseForecastSpec
} from '../src/cash';

const base = (): BaseForecastSpec => ({ ...DEMO_FORECAST_SPEC, supplierObligations: DEMO_FORECAST_SPEC.supplierObligations.map((o) => ({ ...o })) });

describe('cashForecast — documented Ms. Li demo constants', () => {
  const baseResult = cashForecast(base());

  it('base case NEVER goes negative inside 30 days', () => {
    expect(baseResult.firstShortageDay).toBeNull();
    expect(baseResult.firstShortageDateISO).toBeNull();
    expect(baseResult.minBalanceFen).toBeGreaterThan(0);
  });

  it('base cash floor is exactly ¥2,400 on day 12 (razor thin — by design)', () => {
    expect(baseResult.minBalanceFen).toBe(240_000);
    expect(baseResult.minBalanceDay).toBe(12);
  });

  it('base alert is WATCH: no shortage, but floor < one week of outflows', () => {
    expect(baseResult.alertLevel).toBe('WATCH');
  });

  const stressed = applyScenario(base(), DEMO_STRESS_PARAMS);

  it('STRESSED (sales −20%, supplier +10%, payout +5d) hits first shortage on DAY 12', () => {
    expect(stressed.firstShortageDay).toBe(12);
  });

  it('stressed floor is −¥39,000 on day 12', () => {
    expect(stressed.minBalanceFen).toBe(-3_900_000);
    expect(stressed.minBalanceDay).toBe(12);
  });

  it('stressed alert is WARNING (shortage after day 7, within 14)', () => {
    expect(stressed.alertLevel).toBe('WARNING');
  });

  it('obligations at the shortage include both supplier payments (scaled +10%)', () => {
    const ids = stressed.obligationsAtShortage.map((o) => o.id).sort();
    expect(ids).toEqual(['demo-sup-1', 'demo-sup-2']);
    expect(stressed.obligationsAtShortage.find((o) => o.id === 'demo-sup-2')?.amountFen).toBe(5_500_000);
  });

  it('scenario results are clearly marked hypothetical via assumptions', () => {
    expect(stressed.completeness.assumptions.length).toBeGreaterThan(0);
  });
});

describe('cashForecast — alerts and mechanics', () => {
  it('CRITICAL when shortage lands within 7 days', () => {
    const r = cashForecast({
      ...base(),
      supplierObligations: [{ id: 's1', label: 'Rent', dueInDays: 3, amountFen: 50_000_000, status: 'DUE' }]
    });
    expect(r.firstShortageDay).toBe(3);
    expect(r.alertLevel).toBe('CRITICAL');
  });

  it('NONE when cash is comfortable', () => {
    const r = cashForecast({ ...base(), openingCashFen: 100_000_000 });
    expect(r.firstShortageDay).toBeNull();
    expect(r.alertLevel).toBe('NONE');
  });

  it('explicit no-shortage result, never an invented date', () => {
    const r = cashForecast({ ...base(), supplierObligations: [] });
    expect(r.firstShortageDay).toBeNull();
    expect(r.firstShortageDateISO).toBeNull();
  });

  it('overdue obligations (dueInDays ≤ 0) land on day 1 and can cause immediate shortage', () => {
    const r = cashForecast({
      ...base(),
      supplierObligations: [{ id: 's1', label: 'Overdue', dueInDays: -5, amountFen: 7_000_000, status: 'OVERDUE' }]
    });
    expect(r.days[0]?.outflowFen).toBe(80_000 + 7_000_000);
    expect(r.firstShortageDay).toBe(1);
  });

  it('extra inflows land on their exact day and are tracked for completeness', () => {
    const r = cashForecast({
      ...base(),
      supplierObligations: [],
      extraInflows: [{ id: 'set1', label: 'Settlement #88', dayOffset: 10, amountFen: 1_000_000 }]
    });
    expect(r.days[9]?.inflowFen).toBe(600_000 + 1_000_000);
    expect(r.completeness.scheduledExtraInflowsFen).toBe(1_000_000);
  });

  it('zero sales and zero spend yields a flat balance line', () => {
    const r = cashForecast({ ...base(), dailySalesFen: 0, adSpendPerDayFen: 0, supplierObligations: [] });
    expect(r.days.every((d) => d.balanceFen === 6_000_000)).toBe(true);
  });

  it('negative opening cash means day-0 is already short → day 1 flags', () => {
    const r = cashForecast({ ...base(), openingCashFen: -100_000, dailySalesFen: 0, adSpendPerDayFen: 0, supplierObligations: [] });
    expect(r.minBalanceFen).toBe(-100_000);
    expect(r.firstShortageDay).toBe(1);
  });

  it('produces one row per horizon day with rising dates', () => {
    const r = cashForecast(base());
    expect(r.days.length).toBe(30);
    expect(r.days[0]?.dateISO).toBe('2026-01-02T00:00:00.000Z');
    expect(r.days[29]?.day).toBe(30);
  });

  it('is deterministic', () => {
    expect(cashForecast(base())).toEqual(cashForecast(base()));
  });
});

describe('applyScenario — clamping and transforms', () => {
  it('clamps percentages to −80..+200 and delay to 0..60', () => {
    const p = clampScenarioParams({ salesChangePct: -95, supplierCostChangePct: 500, settlementDelayDays: 120, adSpendChangePct: -800 });
    expect(p).toEqual({ salesChangePct: -80, supplierCostChangePct: 200, settlementDelayDays: 60, adSpendChangePct: -80 });
  });

  it('treats missing params as zeros', () => {
    expect(clampScenarioParams({})).toEqual({ salesChangePct: 0, supplierCostChangePct: 0, settlementDelayDays: 0, adSpendChangePct: 0 });
  });

  it('sales −80%: inflow drops to ¥1,200/day and the day-12 payment now breaches (shortage day 12)', () => {
    const r = applyScenario(base(), { salesChangePct: -80 });
    expect(r.days[5]?.inflowFen).toBe(120_000);
    expect(r.firstShortageDay).toBe(12);
  });

  it('delay pushes the first inflow day out (−90 sales, delay clamped effects visible)', () => {
    const r = applyScenario(base(), { settlementDelayDays: 2 });
    expect(r.days[5]?.inflowFen).toBe(0); // sales day 6−7 < 1 → no inflow yet on day 6
    expect(r.days[7]?.inflowFen).toBe(600_000);
  });

  it('ad spend scaling changes daily outflow', () => {
    const r = applyScenario(base(), { adSpendChangePct: 50 });
    expect(r.days[0]?.outflowFen).toBe(120_000);
  });

  it('supplier +10% scales obligations (5.5M visible on day 12)', () => {
    const r = applyScenario(base(), { supplierCostChangePct: 10 });
    expect(r.days[11]?.outflowFen).toBe(80_000 + 5_500_000);
  });
});
