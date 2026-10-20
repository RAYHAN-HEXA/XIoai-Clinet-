import { describe, expect, it } from 'vitest';
import { allNumbersFromEngine, collectEngineNumbers, extractNumbers } from '../src/ai/numbers';
import { explain } from '../src/ai/explain';
import type { LlmProvider } from '../src/ai/provider';

/**
 * Numerical-integrity guard: the LLM may only repeat numbers that exist in the
 * engine JSON. Any fabricated amount/percentage/date must cause the text to be
 * discarded in favour of the deterministic template.
 */

const ENGINE_JSON = {
  revenue: 10_000_000, // ¥100,000
  realProfit: 500_000, // ¥5,000
  marginPct: 5,
  firstShortageDay: 12
};

describe('collectEngineNumbers', () => {
  it('adds raw fen values, yuan conversions and small day indexes', () => {
    const allowed = collectEngineNumbers(ENGINE_JSON);
    expect(allowed.has(10_000_000)).toBe(true); // raw fen
    expect(allowed.has(100_000)).toBe(true); // ¥100,000
    expect(allowed.has(5_000)).toBe(true); // ¥5,000
    expect(allowed.has(12)).toBe(true); // day index
  });
});

describe('extractNumbers', () => {
  it('handles thousands separators, decimals, negatives and ¥ signs', () => {
    expect(extractNumbers('Revenue was ¥100,000 and profit ¥5,000')).toEqual([100_000, 5_000]);
    expect(extractNumbers('Margin 5%')).toEqual([5]);
    expect(extractNumbers('down -20%')).toEqual([-20]);
  });
});

describe('allNumbersFromEngine — accepts traceable numbers', () => {
  it('accepts yuan figures derived from fen', () => {
    expect(allNumbersFromEngine('Revenue is ¥100,000 with ¥5,000 profit.', ENGINE_JSON)).toBe(true);
  });

  it('accepts the shortage day and margin', () => {
    expect(allNumbersFromEngine('Cash runs short on day 12. Margin is 5%.', ENGINE_JSON)).toBe(true);
  });
});

describe('allNumbersFromEngine — rejects fabricated numbers', () => {
  it('rejects an invented amount', () => {
    expect(allNumbersFromEngine('Revenue is ¥100,000 and profit is ¥9,999.', ENGINE_JSON)).toBe(false);
  });

  it('rejects an invented percentage', () => {
    expect(allNumbersFromEngine('Margin collapsed to 42% this month.', ENGINE_JSON)).toBe(false);
  });

  it('rejects an invented date/day', () => {
    expect(allNumbersFromEngine('You run out of cash on day 27.', ENGINE_JSON)).toBe(false);
  });

  it('rejects a plausible-but-wrong rounding (>0.5% off)', () => {
    expect(allNumbersFromEngine('Profit was about ¥5,100.', ENGINE_JSON)).toBe(false);
  });
});

describe('explain() — template fallback on fabricated content', () => {
  const template = 'Revenue was ¥100,000 and profit ¥5,000.';

  function provider(name: 'claude' | 'noop', text: string): LlmProvider {
    return {
      name,
      complete: async () => text
    };
  }

  it('uses the template verbatim when the provider is the Noop fallback', async () => {
    const res = await explain(provider('noop', 'ignored'), ENGINE_JSON, template, 'en');
    expect(res.source).toBe('template');
    expect(res.text).toBe(template);
  });

  it('returns the LLM text when every number is traceable', async () => {
    const res = await explain(provider('claude', 'Your profit was ¥5,000 on ¥100,000 of revenue.'), ENGINE_JSON, template, 'en');
    expect(res.source).toBe('llm');
    expect(res.text).toContain('¥5,000');
  });

  it('DISCARDS a hallucinated number and falls back to the template', async () => {
    const res = await explain(provider('claude', 'Your profit was ¥88,888 this month.'), ENGINE_JSON, template, 'en');
    expect(res.source).toBe('template');
    expect(res.text).toBe(template);
  });

  it('falls back to the template on empty provider output', async () => {
    const res = await explain(provider('claude', '   '), ENGINE_JSON, template, 'en');
    expect(res.source).toBe('template');
    expect(res.text).toBe(template);
  });
});
