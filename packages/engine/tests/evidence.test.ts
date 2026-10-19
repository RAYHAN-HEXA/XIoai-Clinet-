import { describe, expect, it } from 'vitest';
import { buildEvidenceTree } from '../src/evidence';
import { anchorInput } from './helpers';

describe('buildEvidenceTree — tap any number, see its source', () => {
  const input = anchorInput();

  it('revenue: level 1 matches the summary, level 3 references raw orders', () => {
    const tree = buildEvidenceTree({ metric: 'revenue', ...input });
    expect(tree.level1.valueFen).toBe(10_000_000);
    expect(tree.level3.length).toBe(4);
    expect(tree.level3[0]?.type).toBe('ORDER');
    expect(tree.level3.every((r) => r.amountFen === 2_500_000)).toBe(true);
  });

  it('realProfit: level 2 is revenue plus the six cost components', () => {
    const tree = buildEvidenceTree({ metric: 'realProfit', ...input });
    expect(tree.level1.valueFen).toBe(500_000);
    const keys = tree.level2.map((c) => c.key);
    expect(keys).toEqual(['revenue', 'cost:productCost', 'cost:advertising', 'cost:influencerCommission', 'cost:delivery', 'cost:refunds', 'cost:platformFees']);
    expect(tree.level1.formula.en).toContain('Revenue −');
  });

  it('refunds: level 3 surfaces the refunding order first, cost share disclosed', () => {
    const tree = buildEvidenceTree({ metric: 'refunds', ...input });
    expect(tree.level1.valueFen).toBe(800_000);
    const channel = tree.level2.find((c) => c.key === 'channel:douyin');
    expect(channel?.sharePct).toBe(100);
    expect(tree.level3[0]?.amountFen).toBe(800_000);
  });

  it('advertising: level 3 references ad rows with campaign labels', () => {
    const tree = buildEvidenceTree({ metric: 'advertising', ...input });
    expect(tree.level1.valueFen).toBe(2_500_000);
    expect(tree.level3[0]?.type).toBe('AD');
    expect(tree.level3[0]?.label).toContain('autumn-launch');
  });

  it('MISSING_DOC invoices produce the amber "disclosed, not hidden" warning', () => {
    const tree = buildEvidenceTree({
      metric: 'realProfit',
      ...input,
      supplierInvoices: [{ id: 'i1', label: 'Supplier A', dueDate: '2026-01-10', amountFen: 1_000_000, status: 'MISSING_DOC' }]
    });
    expect(tree.warnings.some((w) => /disclosed, not hidden/i.test(w.en))).toBe(true);
    expect(tree.warnings.some((w) => w.zh.includes('已披露'))).toBe(true);
  });

  it('unmapped products produce a disclosure warning on realProfit', () => {
    const tree = buildEvidenceTree({
      metric: 'realProfit',
      orders: [{ ...input.orders[0]!, productId: 'ghost', id: 'ghost-order' }],
      adSpend: [],
      products: []
    });
    expect(tree.warnings.some((w) => /no mapped product/.test(w.en))).toBe(true);
  });

  it('is deterministic', () => {
    expect(buildEvidenceTree({ metric: 'realProfit', ...input })).toEqual(buildEvidenceTree({ metric: 'realProfit', ...input }));
  });
});
