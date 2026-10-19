import { describe, expect, it } from 'vitest';
import { dailyBriefData, type BriefInput } from '../src/brief';
import type { EngineOrder } from '../src/types';
import { DEMO_FORECAST_SPEC } from '../src/cash';

const asOf = '2026-01-15T02:00:00.000Z';

function mkOrder(overrides: Partial<EngineOrder>): EngineOrder {
  return {
    id: 'o',
    channel: 'douyin',
    externalId: 'e',
    productId: null,
    orderedAt: asOf,
    grossAmount: 100_000,
    platformFee: 0,
    commission: 0,
    deliveryCost: 0,
    refundAmount: 0,
    status: 'COMPLETED',
    ...overrides
  };
}

function base(overrides: Partial<BriefInput> = {}): BriefInput {
  return {
    asOfISO: asOf,
    supplierInvoices: [],
    orders: [],
    adSpend: [],
    products: [],
    forecastSpec: null,
    approvalsPending: [],
    ...overrides
  };
}

describe('dailyBriefData', () => {
  it('urgent payments: due within 3 days flagged DUE_SOON', () => {
    const r = dailyBriefData(
      base({
        supplierInvoices: [{ id: 'i1', label: 'Fabric Co', amountFen: 4_000_000, dueDate: '2026-01-17', status: 'DUE' }]
      })
    );
    expect(r.urgentPayments[0]?.urgency).toBe('DUE_SOON');
    expect(r.urgentPayments[0]?.id).toBe('i1');
  });

  it('past-due DUE invoices are treated as OVERDUE', () => {
    const r = dailyBriefData(
      base({ supplierInvoices: [{ id: 'i1', label: 'Pack Co', amountFen: 500_000, dueDate: '2026-01-10', status: 'DUE' }] })
    );
    expect(r.urgentPayments[0]?.urgency).toBe('OVERDUE');
    expect(r.overdueInvoices.map((i) => i.id)).toContain('i1');
  });

  it('MISSING_DOC invoices appear in both urgent and missingDocs — disclosed, not hidden', () => {
    const r = dailyBriefData(
      base({ supplierInvoices: [{ id: 'i9', label: 'Ghost Supplier', amountFen: 1_000, dueDate: '2026-02-01', status: 'MISSING_DOC' }] })
    );
    expect(r.missingDocs.map((i) => i.id)).toEqual(['i9']);
    expect(r.urgentPayments[0]?.urgency).toBe('MISSING_DOC');
  });

  it('PAID invoices never appear', () => {
    const r = dailyBriefData(
      base({ supplierInvoices: [{ id: 'p', label: 'Paid Co', amountFen: 900_000, dueDate: '2026-01-16', status: 'PAID' }] })
    );
    expect(r.urgentPayments).toHaveLength(0);
  });

  it('rising costs: ad spend doubling week-over-week (+100%) is flagged', () => {
    const ads = [
      ...Array.from({ length: 7 }, (_, i) => ({ id: `a${i}`, channel: 'douyin', campaign: 'c', date: `2026-01-${String(9 + i).padStart(2, '0')}`, spend: 2_000_000, attributedRevenue: 0 })),
      ...Array.from({ length: 7 }, (_, i) => ({ id: `b${i}`, channel: 'douyin', campaign: 'c', date: `2026-01-${String(2 + i).padStart(2, '0')}`, spend: 1_000_000, attributedRevenue: 0 }))
    ];
    const r = dailyBriefData(base({ adSpend: ads }));
    const adsRow = r.risingCosts.find((c) => c.category.en === 'Advertising');
    expect(adsRow?.changePct).toBe(100);
    expect(adsRow?.changeFen).toBe(7_000_000);
  });

  it('no misleading pct when the prior week is zero (flagged but pct null)', () => {
    const r = dailyBriefData(base({ orders: [mkOrder({ id: 'n', commission: 500_000 })] }));
    const comm = r.risingCosts.find((c) => c.category.en === 'Influencer commission');
    expect(comm?.previousFen).toBe(0);
    expect(comm?.changePct).toBeNull();
    expect(comm?.currentFen).toBe(500_000);
  });

  it('revenue trend computes 7v7 change', () => {
    const orders = [
      ...Array.from({ length: 7 }, (_, i) => mkOrder({ id: `r${i}`, orderedAt: `2026-01-${String(15 - i).padStart(2, '0')}T08:00:00.000Z`, grossAmount: 300_000 })),
      ...Array.from({ length: 7 }, (_, i) => mkOrder({ id: `s${i}`, orderedAt: `2026-01-${String(8 - i).padStart(2, '0')}T08:00:00.000Z`, grossAmount: 100_000 }))
    ];
    const r = dailyBriefData(base({ orders }));
    expect(r.revenueTrend.last7Fen).toBe(2_100_000);
    expect(r.revenueTrend.prior7Fen).toBe(700_000);
    expect(r.revenueTrend.changePct).toBe(200);
  });

  it('cash risk and pending approvals pass through from engine/caller', () => {
    const r = dailyBriefData(
      base({
        forecastSpec: { ...DEMO_FORECAST_SPEC },
        approvalsPending: [{ id: 'rec1', title: 'Extend supplier terms' }]
      })
    );
    expect(r.cashRisk?.alertLevel).toBe('WATCH');
    expect(r.approvalsNeeded[0]?.title).toBe('Extend supplier terms');
  });

  it('is deterministic', () => {
    const input = base({ forecastSpec: { ...DEMO_FORECAST_SPEC } });
    expect(dailyBriefData(input)).toEqual(dailyBriefData(input));
  });
});
