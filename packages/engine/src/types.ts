/**
 * Shared engine contracts. PURE — no I/O, no clock, no randomness, no LLM.
 *
 * MONEY RULE: every Fen value is an integer number of fen (¥1 = 100 fen).
 * No binary floating point participates in authoritative money arithmetic —
 * all sums/differences are integer additions/subtractions of fen.
 * Percentages are presentation-derived (round2) and never feed back into money.
 */

export type Fen = number;

/** Bilingual text produced by the engine; the UI picks per locale. */
export interface LocalizedText {
  en: string;
  zh: string;
}

export type OrderStatus = 'PENDING' | 'COMPLETED' | 'REFUNDED' | 'CANCELLED';

export interface EngineOrder {
  id: string;
  channel: string;
  externalId: string;
  productId: string | null;
  /** ISO 8601 timestamp */
  orderedAt: string;
  grossAmount: Fen;
  platformFee: Fen;
  /** influencer / affiliate commission */
  commission: Fen;
  deliveryCost: Fen;
  refundAmount: Fen;
  status: OrderStatus;
  sourceId?: string | null;
}

export interface EngineAdSpend {
  id: string;
  channel: string;
  campaign: string;
  /** ISO date (YYYY-MM-DD) */
  date: string;
  spend: Fen;
  attributedRevenue: Fen;
  sourceId?: string | null;
}

export interface EngineProduct {
  id: string;
  sku: string;
  name: string;
  unitCost: Fen;
}

export interface EngineSupplierInvoice {
  id: string;
  label: string;
  /** ISO date (YYYY-MM-DD) */
  dueDate: string;
  amountFen: Fen;
  status: 'PAID' | 'DUE' | 'OVERDUE' | 'MISSING_DOC';
}

export type EvidenceType = 'ORDER' | 'AD' | 'INVOICE' | 'SETTLEMENT';

export interface EvidenceRef {
  type: EvidenceType;
  id: string;
  label: string;
  amountFen: Fen;
  /** ISO date or timestamp */
  dateISO: string;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sumFen(values: Iterable<number>): Fen {
  // integers only — exact
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/** Lexicographic compare of ISO date prefixes (YYYY-MM-DD) — deterministic, no Date parsing. */
export function isoDay(iso: string): string {
  return iso.slice(0, 10);
}

/** Deterministic date-N arithmetic (pure: derives from the given input, not the clock). */
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** Whole days from `fromISO` to `toISO` (to − from), both ISO. */
export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((new Date(toISO).getTime() - new Date(fromISO).getTime()) / 86_400_000);
}
