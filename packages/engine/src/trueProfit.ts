import {
  type EngineAdSpend,
  type EngineOrder,
  type EngineProduct,
  type Fen,
  type LocalizedText,
  round2,
  sumFen
} from './types';

/**
 * True Profit Detective.
 *
 * METHODOLOGY (documented in docs/FINANCIAL_METHODOLOGY.md):
 *  - Revenue  = Σ grossAmount of orders with status COMPLETED or REFUNDED.
 *               (A refunded order still generated gross revenue; its refund is
 *               a separate cost line below. PENDING and CANCELLED are excluded.)
 *  - Refunds  = Σ refundAmount over included orders.
 *  - Product cost = Σ product.unitCost for included orders whose product is
 *               mapped (assumption: one unit per order line — disclosed in meta).
 *  - Commission/delivery/platform fees = Σ over included orders.
 *  - Advertising  = Σ adSpend.spend (all rows — spend happens regardless).
 *  - realProfit   = revenue − productCost − advertising − commission − delivery − refunds − platformFees.
 *
 * Every cost is counted EXACTLY ONCE in the summary (no double counting).
 * Groupings are views on the same inputs; byChannel profit reconciles to
 * realProfit, byProduct deliberately excludes advertising (unknown per-product
 * attribution — disclosed, not invented).
 */

export interface TrueProfitInput {
  orders: EngineOrder[];
  adSpend: EngineAdSpend[];
  products: EngineProduct[];
}

export interface CostBreakdown {
  productCost: Fen;
  advertising: Fen;
  influencerCommission: Fen;
  delivery: Fen;
  refunds: Fen;
  platformFees: Fen;
}

export interface TrueProfitSummary extends CostBreakdown {
  revenue: Fen;
  totalCosts: Fen;
  realProfit: Fen;
  /** percent, round2 — null when revenue is 0 (no meaningful margin) */
  marginPct: number | null;
  /** each cost as % of revenue, null when revenue is 0 */
  costRatiosPct: Record<keyof CostBreakdown, number | null>;
}

export interface GroupRow {
  key: string;
  label: string;
  revenue: Fen;
  productCost: Fen;
  influencerCommission: Fen;
  delivery: Fen;
  refunds: Fen;
  platformFees: Fen;
  /** advertising allocated to this group (byChannel/byCampaign only) */
  advertising?: Fen;
  /** byProduct: excludes advertising (documented limitation) */
  profit: Fen;
  marginPct: number | null;
  orders: number;
  /** byCampaign only: attributedRevenue / spend */
  roas: number | null;
}

export interface TrueProfitMeta {
  ordersIncluded: number;
  ordersExcludedCancelled: number;
  ordersExcludedPending: number;
  ordersMissingProduct: number;
  unattributedProductCostFen: Fen; // always 0 today — the gap is disclosed, not invented
  adRowsIncluded: number;
  notes: LocalizedText[];
}

export interface TrueProfitResult {
  summary: TrueProfitSummary;
  byProduct: GroupRow[];
  byCampaign: GroupRow[];
  byChannel: GroupRow[];
  meta: TrueProfitMeta;
}

const COST_KEYS = [
  'productCost',
  'advertising',
  'influencerCommission',
  'delivery',
  'refunds',
  'platformFees'
] as const;

function marginPctOf(profit: Fen, revenue: Fen): number | null {
  return revenue > 0 ? round2((profit / revenue) * 100) : null;
}

function ratios(summary: Omit<TrueProfitSummary, 'costRatiosPct' | 'marginPct' | 'totalCosts' | 'realProfit'>): TrueProfitSummary['costRatiosPct'] {
  const out = {} as TrueProfitSummary['costRatiosPct'];
  for (const k of COST_KEYS) {
    out[k] = summary.revenue > 0 ? round2((summary[k] / summary.revenue) * 100) : null;
  }
  return out;
}

export function trueProfit(input: TrueProfitInput): TrueProfitResult {
  const { orders, adSpend, products } = input;

  const productMap = new Map<string, EngineProduct>();
  for (const p of products) productMap.set(p.id, p);

  const included = orders.filter((o) => o.status === 'COMPLETED' || o.status === 'REFUNDED');
  const excludedCancelled = orders.filter((o) => o.status === 'CANCELLED').length;
  const excludedPending = orders.filter((o) => o.status === 'PENDING').length;

  const revenue = sumFen(included.map((o) => o.grossAmount));
  const refunds = sumFen(included.map((o) => o.refundAmount));
  const influencerCommission = sumFen(included.map((o) => o.commission));
  const delivery = sumFen(included.map((o) => o.deliveryCost));
  const platformFees = sumFen(included.map((o) => o.platformFee));
  const advertising = sumFen(adSpend.map((a) => a.spend));

  let productCost = 0;
  let ordersMissingProduct = 0;
  for (const o of included) {
    const product = o.productId ? productMap.get(o.productId) : undefined;
    if (product) {
      productCost += product.unitCost; // 1 unit per order line — disclosed assumption
    } else {
      ordersMissingProduct += 1; // cost unknown → disclosed, never invented
    }
  }

  const totalCosts = productCost + advertising + influencerCommission + delivery + refunds + platformFees;
  const realProfit = revenue - totalCosts;

  const baseSummary = {
    revenue,
    productCost,
    advertising,
    influencerCommission,
    delivery,
    refunds,
    platformFees
  };

  const summary: TrueProfitSummary = {
    ...baseSummary,
    totalCosts,
    realProfit,
    marginPct: marginPctOf(realProfit, revenue),
    costRatiosPct: ratios(baseSummary)
  };

  const meta: TrueProfitMeta = {
    ordersIncluded: included.length,
    ordersExcludedCancelled: excludedCancelled,
    ordersExcludedPending: excludedPending,
    ordersMissingProduct,
    unattributedProductCostFen: 0,
    adRowsIncluded: adSpend.length,
    notes: [
      {
        en: 'One unit per order line is assumed for product cost; orders without a mapped product contribute no product cost (disclosed, not estimated).',
        zh: '商品成本按每单一件计算；未映射商品的订单不计商品成本（已披露，不做估算）。'
      },
      {
        en: 'PENDING and CANCELLED orders are excluded from profit; REFUNDED orders keep their gross revenue with refunds shown as a cost line.',
        zh: '待处理和已取消订单不计入利润；已退款订单保留其营收，退款金额单列为成本项。'
      }
    ]
  };

  return {
    summary,
    byProduct: groupByProduct(included, productMap),
    byCampaign: groupByCampaign(adSpend),
    byChannel: groupByChannel(included, adSpend, productMap),
    meta
  };
}

function emptyRow(key: string, label: string): GroupRow {
  return {
    key,
    label,
    revenue: 0,
    productCost: 0,
    influencerCommission: 0,
    delivery: 0,
    refunds: 0,
    platformFees: 0,
    profit: 0,
    marginPct: null,
    orders: 0,
    roas: null
  };
}

function groupByProduct(orders: EngineOrder[], productMap: Map<string, EngineProduct>): GroupRow[] {
  const rows = new Map<string, GroupRow>();
  for (const o of orders) {
    const product = o.productId ? productMap.get(o.productId) : undefined;
    const key = product ? product.id : 'unattributed';
    let row = rows.get(key);
    if (!row) {
      row = emptyRow(key, product ? product.name : 'Unmapped products');
      rows.set(key, row);
    }
    row.revenue += o.grossAmount;
    row.productCost += product ? product.unitCost : 0;
    row.influencerCommission += o.commission;
    row.delivery += o.deliveryCost;
    row.refunds += o.refundAmount;
    row.platformFees += o.platformFee;
    row.orders += 1;
  }
  const out = [...rows.values()];
  for (const row of out) {
    row.profit =
      row.revenue - row.productCost - row.influencerCommission - row.delivery - row.refunds - row.platformFees;
    row.marginPct = marginPctOf(row.profit, row.revenue);
  }
  return out.sort((a, b) => b.profit - a.profit || a.key.localeCompare(b.key));
}

function groupByCampaign(adSpend: EngineAdSpend[]): GroupRow[] {
  const rows = new Map<string, GroupRow>();
  for (const a of adSpend) {
    let row = rows.get(a.campaign);
    if (!row) {
      row = emptyRow(a.campaign, a.campaign);
      rows.set(a.campaign, row);
    }
    row.revenue += a.attributedRevenue;
    row.advertising = (row.advertising ?? 0) + a.spend;
  }
  const out = [...rows.values()];
  for (const row of out) {
    const spend = row.advertising ?? 0;
    row.profit = row.revenue - spend; // contribution based on platform-attributed revenue
    row.marginPct = marginPctOf(row.profit, row.revenue);
    row.roas = spend > 0 ? round2(row.revenue / spend) : null;
  }
  return out.sort((a, b) => b.profit - a.profit || a.key.localeCompare(b.key));
}

function groupByChannel(
  orders: EngineOrder[],
  adSpend: EngineAdSpend[],
  productMap: Map<string, EngineProduct>
): GroupRow[] {
  const rows = new Map<string, GroupRow>();
  const rowFor = (channel: string): GroupRow => {
    let row = rows.get(channel);
    if (!row) {
      row = emptyRow(channel, channel);
      rows.set(channel, row);
    }
    return row;
  };

  for (const o of orders) {
    const row = rowFor(o.channel);
    const product = o.productId ? productMap.get(o.productId) : undefined;
    row.revenue += o.grossAmount;
    row.productCost += product ? product.unitCost : 0;
    row.influencerCommission += o.commission;
    row.delivery += o.deliveryCost;
    row.refunds += o.refundAmount;
    row.platformFees += o.platformFee;
    row.orders += 1;
  }
  for (const a of adSpend) {
    const row = rowFor(a.channel);
    row.advertising = (row.advertising ?? 0) + a.spend;
  }

  const out = [...rows.values()];
  for (const row of out) {
    row.profit =
      row.revenue -
      row.productCost -
      (row.advertising ?? 0) -
      row.influencerCommission -
      row.delivery -
      row.refunds -
      row.platformFees;
    row.marginPct = marginPctOf(row.profit, row.revenue);
  }
  return out.sort((a, b) => b.profit - a.profit || a.key.localeCompare(b.key));
}
