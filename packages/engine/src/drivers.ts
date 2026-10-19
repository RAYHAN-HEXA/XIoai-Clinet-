import { trueProfit, type TrueProfitResult } from './trueProfit';
import type { EngineAdSpend, EngineOrder, EngineProduct as Product, EvidenceRef, Fen, LocalizedText } from './types';

/**
 * Driver Explainer — decomposes the profit change between two periods.
 *
 * METHODOLOGY: contributions are defined so they reconcile EXACTLY:
 *   revenue driver contribution = cur.revenue − prev.revenue
 *   cost driver contribution    = −(cur.cost − prev.cost)
 *   Σ contributions ≡ cur.realProfit − prev.realProfit   (identity, tested)
 *
 * Percentage difference is null whenever the previous value is 0 — reporting
 * "+∞%" would be misleading. Rank = |contribution| desc, stable tiebreak by id.
 */

export interface ProfitPeriod {
  orders: EngineOrder[];
  adSpend: EngineAdSpend[];
  products: Product[];
}

export type DriverId =
  | 'revenue'
  | 'productCost'
  | 'advertising'
  | 'influencerCommission'
  | 'delivery'
  | 'refunds'
  | 'platformFees';

export interface ProfitDriver {
  id: DriverId;
  label: LocalizedText;
  previousValue: Fen;
  currentValue: Fen;
  absDiff: Fen;
  /** null when previousValue is 0 — a percentage off a zero base is meaningless */
  pctDiff: number | null;
  /** signed fen impact on profit (positive = helped profit) */
  contributionToFenProfitChange: number;
  impactOnProfit: 'POSITIVE' | 'NEGATIVE' | 'NONE';
  evidenceRefs: EvidenceRef[];
}

export interface ProfitDriversResult {
  previousProfitFen: number;
  currentProfitFen: number;
  profitChangeFen: number;
  /** null when previous profit is 0 */
  profitChangePct: number | null;
  drivers: ProfitDriver[];
  method: LocalizedText;
}

const DRIVER_DEFS: Array<{
  id: DriverId;
  label: LocalizedText;
  value: (s: TrueProfitResult['summary']) => number;
  sign: 1 | -1; // +1 revenue-style, −1 cost-style
}> = [
  { id: 'revenue', label: { en: 'Revenue', zh: '营收' }, value: (s) => s.revenue, sign: 1 },
  { id: 'productCost', label: { en: 'Product cost', zh: '商品成本' }, value: (s) => s.productCost, sign: -1 },
  { id: 'advertising', label: { en: 'Advertising', zh: '广告投放' }, value: (s) => s.advertising, sign: -1 },
  { id: 'influencerCommission', label: { en: 'Influencer commission', zh: '达人佣金' }, value: (s) => s.influencerCommission, sign: -1 },
  { id: 'delivery', label: { en: 'Delivery', zh: '物流费' }, value: (s) => s.delivery, sign: -1 },
  { id: 'refunds', label: { en: 'Refunds', zh: '退款' }, value: (s) => s.refunds, sign: -1 },
  { id: 'platformFees', label: { en: 'Platform fees', zh: '平台费用' }, value: (s) => s.platformFees, sign: -1 }
];

const EVIDENCE_CAP = 10;

function evidenceFor(driverId: DriverId, period: ProfitPeriod, products: Map<string, Product>): EvidenceRef[] {
  const byAmount = (a: Fen, b: Fen) => b - a;
  switch (driverId) {
    case 'revenue':
      return [...period.orders]
        .sort((a, b) => byAmount(a.grossAmount, b.grossAmount) || a.id.localeCompare(b.id))
        .slice(0, EVIDENCE_CAP)
        .map((o) => ({ type: 'ORDER' as const, id: o.id, label: `#${o.externalId} · ${o.channel}`, amountFen: o.grossAmount, dateISO: o.orderedAt }));
    case 'advertising':
      return [...period.adSpend]
        .sort((a, b) => byAmount(a.spend, b.spend) || a.id.localeCompare(b.id))
        .slice(0, EVIDENCE_CAP)
        .map((a) => ({ type: 'AD' as const, id: a.id, label: `${a.campaign} · ${a.channel}`, amountFen: a.spend, dateISO: a.date }));
    case 'productCost':
      return [...period.orders]
        .sort((a, b) => {
          const ca = (a.productId ? products.get(a.productId)?.unitCost : 0) ?? 0;
          const cb = (b.productId ? products.get(b.productId)?.unitCost : 0) ?? 0;
          return byAmount(ca, cb) || a.id.localeCompare(b.id);
        })
        .slice(0, EVIDENCE_CAP)
        .map((o) => {
          const product = o.productId ? products.get(o.productId) : undefined;
          return {
            type: 'ORDER' as const,
            id: o.id,
            label: `#${o.externalId} · ${product ? product.sku : 'unmapped'}`,
            amountFen: product ? product.unitCost : 0,
            dateISO: o.orderedAt
          };
        });
    case 'influencerCommission':
    case 'delivery':
    case 'refunds':
    case 'platformFees': {
      // engine metric ids ≠ order field names — map explicitly
      const field = ({
        influencerCommission: 'commission',
        delivery: 'deliveryCost',
        refunds: 'refundAmount',
        platformFees: 'platformFee'
      } as const)[driverId];
      return [...period.orders]
        .sort((a, b) => byAmount(a[field], b[field]) || a.id.localeCompare(b.id))
        .slice(0, EVIDENCE_CAP)
        .map((o) => ({ type: 'ORDER' as const, id: o.id, label: `#${o.externalId} · ${o.channel}`, amountFen: o[field], dateISO: o.orderedAt }));
    }
  }
}

export function profitDrivers(current: ProfitPeriod, previous: ProfitPeriod): ProfitDriversResult {
  const cur = trueProfit(current).summary;
  const prev = trueProfit(previous).summary;

  const products = new Map<string, Product>();
  for (const p of current.products) products.set(p.id, p);

  const drivers: ProfitDriver[] = DRIVER_DEFS.map((def) => {
    const previousValue = def.value(prev);
    const currentValue = def.value(cur);
    const absDiff = currentValue - previousValue;
    const contribution = def.sign * absDiff;
    return {
      id: def.id,
      label: def.label,
      previousValue,
      currentValue,
      absDiff,
      pctDiff: previousValue !== 0 ? Math.round((absDiff / Math.abs(previousValue)) * 10000) / 100 : null,
      contributionToFenProfitChange: contribution,
      impactOnProfit: contribution > 0 ? 'POSITIVE' : contribution < 0 ? 'NEGATIVE' : 'NONE',
      evidenceRefs: evidenceFor(def.id, current, products)
    };
  });

  drivers.sort(
    (a, b) =>
      Math.abs(b.contributionToFenProfitChange) - Math.abs(a.contributionToFenProfitChange) ||
      DRIVER_DEFS.findIndex((d) => d.id === a.id) - DRIVER_DEFS.findIndex((d) => d.id === b.id)
  );

  const profitChangeFen = cur.realProfit - prev.realProfit;

  return {
    previousProfitFen: prev.realProfit,
    currentProfitFen: cur.realProfit,
    profitChangeFen,
    profitChangePct:
      prev.realProfit !== 0
        ? Math.round((profitChangeFen / Math.abs(prev.realProfit)) * 10000) / 100
        : null,
    drivers,
    method: {
      en: 'Each driver’s contribution is its period-over-period change, signed by whether it adds to or subtracts from profit. Contributions sum exactly to the total profit change.',
      zh: '每个驱动因素的影响等于其两期之间的变化额，按其增加还是减少利润确定正负号。所有驱动因素的贡献之和恰好等于利润总变化。'
    }
  };
}
