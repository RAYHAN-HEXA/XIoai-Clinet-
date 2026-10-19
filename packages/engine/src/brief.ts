import { cashForecast, type BaseForecastSpec, type CashForecastResult } from './cash';
import { isoDay, sumFen, type EngineAdSpend, type EngineOrder, type EngineProduct, type Fen, type LocalizedText } from './types';

/**
 * Daily Brief data — deterministic structure behind 老板每日经营简报.
 * The AI layer may polish wording; the CONTENT and NUMBERS come from here.
 */

export interface BriefInvoice {
  id: string;
  label: string;
  amountFen: Fen;
  /** ISO date */
  dueDate: string;
  status: 'PAID' | 'DUE' | 'OVERDUE' | 'MISSING_DOC';
}

export interface BriefInput {
  /** ISO datetime of the briefing moment (explicit — never clocked) */
  asOfISO: string;
  supplierInvoices: BriefInvoice[];
  orders: EngineOrder[];
  adSpend: EngineAdSpend[];
  products: EngineProduct[];
  forecastSpec: BaseForecastSpec | null;
  approvalsPending: Array<{ id: string; title: string }>;
  /** rising-cost thresholds */
  minAbsChangeFen?: Fen;
  minPctChange?: number;
}

export interface DailyBriefData {
  asOfISO: string;
  urgentPayments: Array<BriefInvoice & { urgency: 'OVERDUE' | 'DUE_SOON' | 'MISSING_DOC' }>;
  overdueInvoices: BriefInvoice[];
  risingCosts: Array<{ category: LocalizedText; previousFen: Fen; currentFen: Fen; changeFen: Fen; changePct: number | null }>;
  approvalsNeeded: Array<{ id: string; title: string }>;
  missingDocs: BriefInvoice[];
  cashRisk: { alertLevel: CashForecastResult['alertLevel']; firstShortageDay: number | null; minBalanceFen: Fen } | null;
  revenueTrend: { last7Fen: Fen; prior7Fen: Fen; changePct: number | null };
}

const CATEGORY_LABELS: Array<{ id: 'influencerCommission' | 'delivery' | 'refunds' | 'platformFees' | 'advertising'; label: LocalizedText }> = [
  { id: 'influencerCommission', label: { en: 'Influencer commission', zh: '达人佣金' } },
  { id: 'delivery', label: { en: 'Delivery', zh: '物流费' } },
  { id: 'refunds', label: { en: 'Refunds', zh: '退款' } },
  { id: 'platformFees', label: { en: 'Platform fees', zh: '平台费用' } },
  { id: 'advertising', label: { en: 'Advertising', zh: '广告投放' } }
];

/** UTC-midnight epoch for a YYYY-MM-DD prefix — tolerant of unpadded components. */
function utcDay(iso: string): number {
  const [y, m, d] = isoDay(iso).split('-');
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
}

export function dailyBriefData(input: BriefInput): DailyBriefData {
  const todayMs = utcDay(input.asOfISO);
  const day = (iso: string): number => Math.round((utcDay(iso) - todayMs) / 86_400_000);

  // ── invoices ──────────────────────────────────────────────────────────────
  const unpaid = input.supplierInvoices.filter((i) => i.status !== 'PAID');
  const urgentPayments = unpaid
    .filter((i) => i.status === 'MISSING_DOC' || i.status === 'OVERDUE' || (i.status === 'DUE' && day(i.dueDate) <= 3))
    .map((i) => ({
      ...i,
      urgency: (i.status === 'MISSING_DOC' ? 'MISSING_DOC' : i.status === 'OVERDUE' || day(i.dueDate) < 0 ? 'OVERDUE' : 'DUE_SOON') as
        | 'OVERDUE'
        | 'DUE_SOON'
        | 'MISSING_DOC'
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));

  const overdueInvoices = unpaid
    .filter((i) => i.status === 'OVERDUE' || (i.status === 'DUE' && day(i.dueDate) < 0))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const missingDocs = unpaid.filter((i) => i.status === 'MISSING_DOC');

  // ── rising costs: last 7 days vs the 7 before ─────────────────────────────
  const inWindow = (iso: string, fromOffset: number, toOffset: number): boolean => {
    const d = day(iso);
    return d >= fromOffset && d <= toOffset;
  };
  const last7Orders = input.orders.filter((o) => inWindow(isoDay(o.orderedAt), -6, 0));
  const prior7Orders = input.orders.filter((o) => inWindow(isoDay(o.orderedAt), -13, -7));
  const last7Ads = sumFen(input.adSpend.filter((a) => inWindow(isoDay(a.date), -6, 0)).map((a) => a.spend));
  const prior7Ads = sumFen(input.adSpend.filter((a) => inWindow(isoDay(a.date), -13, -7)).map((a) => a.spend));

  const minAbs = input.minAbsChangeFen ?? 100_000; // ¥1,000 default
  const minPct = input.minPctChange ?? 20;

  const bucket = (orders: EngineOrder[]): { influencerCommission: Fen; delivery: Fen; refunds: Fen; platformFees: Fen } => {
    const acc = { influencerCommission: 0, delivery: 0, refunds: 0, platformFees: 0 };
    for (const o of orders) {
      acc.influencerCommission += o.commission;
      acc.delivery += o.deliveryCost;
      acc.refunds += o.refundAmount;
      acc.platformFees += o.platformFee;
    }
    return acc;
  };
  const last7 = bucket(last7Orders);
  const prior7 = bucket(prior7Orders);

  const risingCosts = CATEGORY_LABELS.map((c) => {
    const currentFen = c.id === 'advertising' ? last7Ads : last7[c.id];
    const previousFen = c.id === 'advertising' ? prior7Ads : prior7[c.id];
    const changeFen = currentFen - previousFen;
    const changePct = previousFen !== 0 ? Math.round((changeFen / Math.abs(previousFen)) * 10000) / 100 : null;
    return { category: c.label, previousFen, currentFen, changeFen, changePct };
  })
    .filter((r) => r.changeFen >= Math.max(1, minAbs) && ((r.changePct !== null && r.changePct >= minPct) || r.previousFen === 0))
    .sort((a, b) => b.changeFen - a.changeFen);

  // ── revenue trend ─────────────────────────────────────────────────────────
  const last7Rev = sumFen(last7Orders.filter((o) => o.status !== 'PENDING' && o.status !== 'CANCELLED').map((o) => o.grossAmount));
  const prior7Rev = sumFen(prior7Orders.filter((o) => o.status !== 'PENDING' && o.status !== 'CANCELLED').map((o) => o.grossAmount));
  const revenueTrend = {
    last7Fen: last7Rev,
    prior7Fen: prior7Rev,
    changePct: prior7Rev !== 0 ? Math.round(((last7Rev - prior7Rev) / Math.abs(prior7Rev)) * 10000) / 100 : null
  };

  // ── cash risk ─────────────────────────────────────────────────────────────
  const forecast: CashForecastResult | null = input.forecastSpec ? cashForecast(input.forecastSpec) : null;
  const cashRisk = forecast
    ? { alertLevel: forecast.alertLevel, firstShortageDay: forecast.firstShortageDay, minBalanceFen: forecast.minBalanceFen }
    : null;

  return {
    asOfISO: input.asOfISO,
    urgentPayments,
    overdueInvoices,
    risingCosts,
    approvalsNeeded: input.approvalsPending,
    missingDocs,
    cashRisk,
    revenueTrend
  };
}
