import { describe, expect, it } from 'vitest';
import { financingMatcher } from '../src/financing';

describe('financingMatcher — documented ranking rules', () => {
  it('short gap (< 14 days) → extend supplier terms ranks first', () => {
    const r = financingMatcher({ gapAmountFen: 2_000_000, firstShortageDay: 12, reason: 'SHORT_GAP' });
    expect(r.ranked[0]?.id).toBe('EXTEND_SUPPLIER_TERMS');
    expect(r.ranked.map((o) => o.rank)).toEqual([1, 2, 3, 4]);
  });

  it('payout delayed → settlement advance ranks first', () => {
    const r = financingMatcher({ gapAmountFen: 3_000_000, firstShortageDay: 9, reason: 'PAYOUT_DELAYED' });
    expect(r.ranked[0]?.id).toBe('SETTLEMENT_ADVANCE');
  });

  it('seasonal stock-up → merchant working-capital loan ranks first', () => {
    const r = financingMatcher({ gapAmountFen: 8_000_000, firstShortageDay: 20, reason: 'SEASONAL_STOCKUP' });
    expect(r.ranked[0]?.id).toBe('MERCHANT_WORKING_CAPITAL');
  });

  it('planned expansion → bank SME loan ranks first', () => {
    const r = financingMatcher({ gapAmountFen: null, firstShortageDay: null, reason: 'PLANNED_EXPANSION' });
    expect(r.ranked[0]?.id).toBe('BANK_SME_LOAN');
  });

  it('no gap → explicit "no shortage" summary and qualitative disclaimer present', () => {
    const r = financingMatcher({ gapAmountFen: null, firstShortageDay: null, reason: 'SHORT_GAP' });
    expect(r.gapSummary.en).toMatch(/No cash shortage/);
    expect(r.disclaimer.zh).toContain('定性');
  });

  it('every option carries bilingual bestWhen, docs and risks; never any rate numbers', () => {
    const r = financingMatcher({ gapAmountFen: 1_000_000, firstShortageDay: 10, reason: 'SHORT_GAP' });
    for (const o of r.ranked) {
      expect(o.bestWhen.en.length).toBeGreaterThan(5);
      expect(o.bestWhen.zh.length).toBeGreaterThan(5);
      expect(o.documents.length).toBeGreaterThan(0);
      expect(o.risks.length).toBeGreaterThan(0);
    }
    const serialized = JSON.stringify(r.ranked);
    expect(serialized).not.toMatch(/\d+(\.\d+)?\s*%/); // no invented interest rates
  });

  it('ranking is deterministic for identical input', () => {
    const input = { gapAmountFen: 2_000_000 as number | null, firstShortageDay: 12 as number | null, reason: 'SHORT_GAP' as const };
    expect(financingMatcher(input)).toEqual(financingMatcher(input));
  });
});
