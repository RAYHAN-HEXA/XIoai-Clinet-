import { describe, expect, it } from 'vitest';
import { profitDrivers, type ProfitPeriod } from '../src/drivers';
import type { EngineOrder, EngineProduct } from '../src/types';

const product: EngineProduct = { id: 'p1', sku: 'S1', name: 'Mug', unitCost: 200_000 };

let seq = 0;
function order(overrides: Partial<EngineOrder>): EngineOrder {
  seq += 1;
  return {
    id: `gen-${seq}`,
    channel: 'douyin',
    externalId: 'e',
    productId: 'p1',
    orderedAt: '2026-02-01T10:00:00.000Z',
    grossAmount: 1_000_000,
    platformFee: 50_000,
    commission: 100_000,
    deliveryCost: 60_000,
    refundAmount: 0,
    status: 'COMPLETED',
    ...overrides
  };
}

function period(orders: EngineOrder[]): ProfitPeriod {
  return { orders, adSpend: [], products: [product] };
}

describe('profitDrivers', () => {
  const previous = period([
    order({ id: 'a', refundAmount: 100_000 }),
    order({ id: 'b' })
  ]);
  const current = period([
    order({ id: 'c', grossAmount: 900_000 }), // revenue down 10%
    order({ id: 'd', refundAmount: 300_000 }) // refunds up
  ]);
  const result = profitDrivers(current, previous);

  it('drivers reconcile EXACTLY to the total profit change', () => {
    const sum = result.drivers.reduce((acc, d) => acc + d.contributionToFenProfitChange, 0);
    expect(sum).toBe(result.profitChangeFen);
    expect(result.profitChangeFen).toBe(result.currentProfitFen - result.previousProfitFen);
  });

  it('ranks drivers by absolute contribution', () => {
    const abs = result.drivers.map((d) => Math.abs(d.contributionToFenProfitChange));
    const sorted = [...abs].sort((x, y) => y - x);
    expect(abs).toEqual(sorted);
  });

  it('reports refunds increase as the top negative driver here', () => {
    const refunds = result.drivers.find((d) => d.id === 'refunds');
    expect(refunds?.absDiff).toBe(200_000);
    expect(refunds?.contributionToFenProfitChange).toBe(-200_000);
    expect(refunds?.impactOnProfit).toBe('NEGATIVE');
  });

  it('null percentage when the previous baseline is zero (no misleading %)', () => {
    const zeroBase = profitDrivers(period([order({ id: 'z', refundAmount: 50_000 })]), period([order({ id: 'y', refundAmount: 0 })]));
    const refunds = zeroBase.drivers.find((d) => d.id === 'refunds');
    expect(refunds?.previousValue).toBe(0);
    expect(refunds?.pctDiff).toBeNull();
  });

  it('positive contribution is labeled POSITIVE', () => {
    const up = profitDrivers(period([order({ id: 'u', grossAmount: 2_000_000 })]), period([order({ id: 'v', grossAmount: 1_000_000 })]));
    const revenue = up.drivers.find((d) => d.id === 'revenue');
    expect(revenue?.contributionToFenProfitChange).toBe(1_000_000);
    expect(revenue?.impactOnProfit).toBe('POSITIVE');
    expect(up.profitChangePct).toBeGreaterThan(0);
  });

  it('every driver carries evidence refs capped at 10, ordered by amount', () => {
    const many = Array.from({ length: 30 }, (_, i) => order({ id: `m${i}`, refundAmount: (i + 1) * 10_000 }));
    const r = profitDrivers(period(many), period([]));
    const refunds = r.drivers.find((d) => d.id === 'refunds');
    expect(refunds?.evidenceRefs.length).toBe(10);
    const amounts = refunds?.evidenceRefs.map((e) => e.amountFen) ?? [];
    expect([...amounts].sort((a, b) => b - a)).toEqual(amounts);
  });

  it('provides a bilingual method note', () => {
    expect(result.method.en.length).toBeGreaterThan(10);
    expect(result.method.zh.length).toBeGreaterThan(10);
  });
});
