import { describe, expect, it } from 'vitest';
import { trueProfit } from '../src/trueProfit';
import type { EngineOrder } from '../src/types';
import { anchorInput } from './helpers';

export { anchorInput };

function mkOrder(overrides: Partial<EngineOrder>): EngineOrder {
  return {
    id: 'x',
    channel: 'douyin',
    externalId: 'x1',
    productId: null,
    orderedAt: '2026-01-05T10:00:00.000Z',
    grossAmount: 1_000_000,
    platformFee: 0,
    commission: 0,
    deliveryCost: 0,
    refundAmount: 0,
    status: 'COMPLETED',
    ...overrides
  };
}

describe('trueProfit — the ¥100,000 anchor', () => {
  const r = trueProfit(anchorInput());

  it('reproduces ¥100,000 revenue exactly', () => {
    expect(r.summary.revenue).toBe(10_000_000); // ¥100,000
  });

  it('reproduces every cost line in fen', () => {
    expect(r.summary.productCost).toBe(2_500_000); // ¥25,000
    expect(r.summary.advertising).toBe(2_500_000); // ¥25,000
    expect(r.summary.influencerCommission).toBe(2_000_000); // ¥20,000
    expect(r.summary.delivery).toBe(1_200_000); // ¥12,000
    expect(r.summary.refunds).toBe(800_000); // ¥8,000
    expect(r.summary.platformFees).toBe(500_000); // ¥5,000
  });

  it('reproduces ¥5,000 real profit and 5% margin', () => {
    expect(r.summary.realProfit).toBe(500_000); // ¥5,000
    expect(r.summary.marginPct).toBe(5);
  });

  it('totalCosts equals the sum of all six cost lines (no double counting)', () => {
    expect(r.summary.totalCosts).toBe(9_500_000);
    expect(r.summary.totalCosts).toBe(
      r.summary.productCost + r.summary.advertising + r.summary.influencerCommission + r.summary.delivery + r.summary.refunds + r.summary.platformFees
    );
  });

  it('computes cost-to-revenue ratios (advertising 25%)', () => {
    expect(r.summary.costRatiosPct['advertising']).toBe(25);
    expect(r.summary.costRatiosPct['refunds']).toBe(8);
  });
});

describe('trueProfit — edge cases', () => {
  it('handles empty input: zeros and null margin', () => {
    const r = trueProfit({ orders: [], adSpend: [], products: [] });
    expect(r.summary.revenue).toBe(0);
    expect(r.summary.realProfit).toBe(0);
    expect(r.summary.marginPct).toBeNull();
  });

  it('margin is null at zero revenue even with ad spend (no fake %)', () => {
    const r = trueProfit({ orders: [], adSpend: [{ id: 'a', channel: 'c', campaign: 'camp', date: '2026-01-01', spend: 500_000, attributedRevenue: 0 }], products: [] });
    expect(r.summary.revenue).toBe(0);
    expect(r.summary.realProfit).toBe(-500_000);
    expect(r.summary.marginPct).toBeNull();
    expect(r.summary.costRatiosPct['advertising']).toBeNull();
  });

  it('survives refunds exceeding revenue (negative profit)', () => {
    const r = trueProfit({
      orders: [mkOrder({ id: 'a', grossAmount: 100_000, refundAmount: 300_000 })],
      adSpend: [],
      products: []
    });
    expect(r.summary.refunds).toBe(300_000);
    expect(r.summary.realProfit).toBe(100_000 - 300_000);
    expect(r.summary.marginPct).toBe(-200);
  });

  it('excludes CANCELLED orders and reports the exclusion', () => {
    const r = trueProfit({
      orders: [mkOrder({ id: 'a', status: 'CANCELLED', grossAmount: 9_999_999 }), mkOrder({ id: 'b', grossAmount: 1_000_000 })],
      adSpend: [],
      products: []
    });
    expect(r.summary.revenue).toBe(1_000_000);
    expect(r.meta.ordersExcludedCancelled).toBe(1);
    expect(r.meta.ordersIncluded).toBe(1);
  });

  it('excludes PENDING orders and reports the exclusion', () => {
    const r = trueProfit({
      orders: [mkOrder({ id: 'a', status: 'PENDING', grossAmount: 5_000_000 }), mkOrder({ id: 'b', status: 'REFUNDED', grossAmount: 1_000_000, refundAmount: 1_000_000 })],
      adSpend: [],
      products: []
    });
    expect(r.summary.revenue).toBe(1_000_000);
    expect(r.meta.ordersExcludedPending).toBe(1);
  });

  it('discloses orders without a mapped product instead of inventing cost', () => {
    const r = trueProfit({
      orders: [mkOrder({ id: 'a', productId: 'nope' }), mkOrder({ id: 'b', productId: 'nope' })],
      adSpend: [],
      products: []
    });
    expect(r.summary.productCost).toBe(0);
    expect(r.meta.ordersMissingProduct).toBe(2);
    expect(r.meta.notes.length).toBeGreaterThan(0);
  });

  it('handles very large amounts without precision loss (integer fen)', () => {
    const big = 4_611_686_018_427_387; // < 2^53
    const r = trueProfit({ orders: [mkOrder({ id: 'a', grossAmount: big })], adSpend: [], products: [] });
    expect(r.summary.revenue).toBe(big);
    expect(r.summary.realProfit).toBe(big);
  });
});

describe('trueProfit — groupings', () => {
  it('byProduct sorts by profit (unattributed 1.1M > p1 0.9M) and labels unmapped products', () => {
    const r = trueProfit({
      orders: [
        mkOrder({ id: 'a', productId: 'p1', grossAmount: 1_000_000 }),
        mkOrder({ id: 'b', productId: null, grossAmount: 2_000_000, platformFee: 900_000 })
      ],
      adSpend: [],
      products: [{ id: 'p1', sku: 'S1', name: 'Mug', unitCost: 100_000 }]
    });
    const unmapped = r.byProduct.find((g) => g.key === 'unattributed');
    const p1 = r.byProduct.find((g) => g.key === 'p1');
    expect(r.byProduct[0]?.key).toBe('unattributed');
    expect(unmapped?.profit).toBe(1_100_000);
    expect(unmapped?.label).toBe('Unmapped products');
    expect(p1?.profit).toBe(900_000);
  });

  it('byProduct deliberately excludes advertising (documented limitation)', () => {
    const base = { orders: [mkOrder({ id: 'a', productId: 'p1', grossAmount: 1_000_000 })], products: [{ id: 'p1', sku: 'S', name: 'X', unitCost: 0 }] };
    const withoutAds = trueProfit({ ...base, adSpend: [] });
    const withAds = trueProfit({ ...base, adSpend: [{ id: 'a1', channel: 'douyin', campaign: 'c', date: '2026-01-01', spend: 300_000, attributedRevenue: 0 }] });
    expect(withAds.byProduct[0]?.profit).toBe(withoutAds.byProduct[0]?.profit);
    expect(withAds.summary.realProfit).toBe(withoutAds.summary.realProfit - 300_000);
  });

  it('byCampaign computes ROAS and null ROAS at zero spend', () => {
    const r = trueProfit({
      orders: [],
      adSpend: [
        { id: 'a1', channel: 'douyin', campaign: 'launch', date: '2026-01-01', spend: 200_000, attributedRevenue: 800_000 },
        { id: 'a2', channel: 'taobao', campaign: 'organic', date: '2026-01-01', spend: 0, attributedRevenue: 5_000 }
      ],
      products: []
    });
    const launch = r.byCampaign.find((c) => c.key === 'launch');
    const organic = r.byCampaign.find((c) => c.key === 'organic');
    expect(launch?.roas).toBe(4);
    expect(launch?.profit).toBe(600_000);
    expect(organic?.roas).toBeNull();
  });

  it('byChannel profit reconciles exactly to realProfit (ads included once)', () => {
    const r = trueProfit(anchorInput());
    const sum = r.byChannel.reduce((acc, c) => acc + c.profit, 0);
    expect(sum).toBe(r.summary.realProfit);
  });

  it('a channel with only ad spend shows a negative contribution row', () => {
    const r = trueProfit({
      orders: [mkOrder({ id: 'a', channel: 'douyin' })],
      adSpend: [{ id: 'a1', channel: 'xiaohongshu', campaign: 'brand', date: '2026-01-01', spend: 250_000, attributedRevenue: 0 }],
      products: []
    });
    const xhs = r.byChannel.find((c) => c.key === 'xiaohongshu');
    expect(xhs?.profit).toBe(-250_000);
    const sum = r.byChannel.reduce((acc, c) => acc + c.profit, 0);
    expect(sum).toBe(r.summary.realProfit);
  });

  it('is deterministic — identical input, identical deep output', () => {
    expect(trueProfit(anchorInput())).toEqual(trueProfit(anchorInput()));
  });
});
