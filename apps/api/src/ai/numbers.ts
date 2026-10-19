/**
 * Numerical integrity guard: every number appearing in an LLM explanation must
 * be traceable to the engine JSON. Anything else (fabricated amounts, dates,
 * percentages) causes the LLM text to be DISCARDED in favor of the template.
 *
 * Allowed set = every number found in the engine JSON, plus common derived
 * forms: yuan conversion of fen (÷100, rounded), absolute values, and small
 * integers ≤ 366 (day indexes, day-of-month references).
 */

const SMALL_INT_MAX = 366;

export function collectEngineNumbers(value: unknown, out: Set<number> = new Set()): Set<number> {
  if (typeof value === 'number' && Number.isFinite(value)) {
    out.add(value);
    out.add(Math.abs(value));
    if (Number.isInteger(value) && Math.abs(value) <= SMALL_INT_MAX) {
      out.add(Math.abs(value)); // day indexes / counts
    } else {
      const yuan = Math.abs(value) / 100;
      out.add(yuan);
      out.add(Math.round(yuan));
      out.add(Math.round(yuan * 100) / 100);
    }
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectEngineNumbers(item, out);
  } else if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) collectEngineNumbers(v, out);
  }
  return out;
}

/** Extract numeric tokens from text: 1,234.56 · -20% · Day 12 · ¥45,000 */
export function extractNumbers(text: string): number[] {
  const matches = text.match(/-?\d[\d,]*(?:\.\d+)?/g) ?? [];
  return matches.map((m) => parseFloat(m.replace(/,/g, ''))).filter((n) => Number.isFinite(n));
}

function isAllowed(n: number, allowed: Set<number>): boolean {
  for (const a of allowed) {
    const tolerance = Math.max(0.011, Math.abs(a) * 0.005);
    if (Math.abs(n - a) <= tolerance) return true;
  }
  return false;
}

/** true when EVERY number in the text is traceable to the engine JSON. */
export function allNumbersFromEngine(text: string, engineJson: unknown): boolean {
  const allowed = collectEngineNumbers(engineJson);
  const numbers = extractNumbers(text);
  return numbers.every((n) => isAllowed(n, allowed));
}
