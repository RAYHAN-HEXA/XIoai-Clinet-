import { trueProfit } from './trueProfit';
import type {
  EngineAdSpend,
  EngineOrder,
  EngineProduct,
  EngineSupplierInvoice,
  EvidenceRef,
  Fen,
  LocalizedText
} from './types';

/**
 * Evidence Tree — "tap any number, see its source".
 * Level 1 headline → Level 2 components → Level 3 raw record refs.
 * The UI distinguishes verified vs derived vs disclosed-gap data via `warnings`.
 */

export type MetricId =
  | 'revenue'
  | 'realProfit'
  | 'productCost'
  | 'advertising'
  | 'influencerCommission'
  | 'delivery'
  | 'refunds'
  | 'platformFees';

export interface EvidenceTreeInput {
  metric: MetricId;
  orders: EngineOrder[];
  adSpend: EngineAdSpend[];
  products: EngineProduct[];
  supplierInvoices?: EngineSupplierInvoice[];
  periodLabel?: string;
}

export interface EvidenceComponent {
  key: string;
  label: LocalizedText;
  valueFen: Fen;
  /** share of the level-1 value where meaningful, else null */
  sharePct: number | null;
}

export interface EvidenceTree {
  metric: MetricId;
  level1: {
    label: LocalizedText;
    valueFen: Fen;
    formula: LocalizedText;
    periodLabel?: string;
  };
  level2: EvidenceComponent[];
  level3: EvidenceRef[];
  warnings: LocalizedText[];
}

const LEVEL3_CAP = 25;

const METRIC_DEFS: Record<
  MetricId,
  { label: LocalizedText; formula: LocalizedText }
> = {
  revenue: {
    label: { en: 'Revenue (gross)', zh: '营收（总额）' },
    formula: { en: 'Σ order gross amounts (COMPLETED + REFUNDED)', zh: '订单总额之和（已完成 + 已退款）' }
  },
  realProfit: {
    label: { en: 'Real profit', zh: '真实利润' },
    formula: {
      en: 'Revenue − product cost − advertising − commission − delivery − refunds − platform fees',
      zh: '营收 − 商品成本 − 广告 − 佣金 − 物流 − 退款 − 平台费用'
    }
  },
  productCost: { label: { en: 'Product cost', zh: '商品成本' }, formula: { en: 'Σ unit cost of mapped products (1 unit/order)', zh: '已映射商品的单件成本之和（每单一件）' } },
  advertising: { label: { en: 'Advertising', zh: '广告投放' }, formula: { en: 'Σ ad spend rows', zh: '广告花费记录之和' } },
  influencerCommission: { label: { en: 'Influencer commission', zh: '达人佣金' }, formula: { en: 'Σ order commission', zh: '订单佣金之和' } },
  delivery: { label: { en: 'Delivery', zh: '物流费' }, formula: { en: 'Σ order delivery cost', zh: '订单物流费之和' } },
  refunds: { label: { en: 'Refunds', zh: '退款' }, formula: { en: 'Σ order refund amounts', zh: '订单退款金额之和' } },
  platformFees: { label: { en: 'Platform fees', zh: '平台费用' }, formula: { en: 'Σ order platform fees', zh: '订单平台费用之和' } }
};

export function buildEvidenceTree(input: EvidenceTreeInput): EvidenceTree {
  const def = METRIC_DEFS[input.metric];
  const result = trueProfit({ orders: input.orders, adSpend: input.adSpend, products: input.products });
  const warnings: LocalizedText[] = [...result.meta.notes];

  if (result.meta.ordersMissingProduct > 0) {
    warnings.push({
      en: `${result.meta.ordersMissingProduct} order(s) have no mapped product — their product cost is unknown and excluded (disclosed, not estimated).`,
      zh: `${result.meta.ordersMissingProduct} 笔订单未映射商品——其商品成本未知，已排除（如实披露，不做估算）。`
    });
  }
  const missingDocs = (input.supplierInvoices ?? []).filter((i) => i.status === 'MISSING_DOC');
  if (missingDocs.length > 0) {
    warnings.push({
      en: `Missing supplier invoice — disclosed, not hidden (${missingDocs.length} item(s)).`,
      zh: `缺失供应商发票——已披露，不隐瞒（${missingDocs.length} 项）。`
    });
  }

  // Level 2 components
  let level2: EvidenceComponent[];
  if (input.metric === 'revenue') {
    level2 = result.byChannel.map((c) => ({
      key: `channel:${c.key}`,
      label: { en: c.label, zh: c.label },
      valueFen: c.revenue,
      sharePct: result.summary.revenue > 0 ? Math.round((c.revenue / result.summary.revenue) * 10000) / 100 : null
    }));
  } else if (input.metric === 'realProfit') {
    const s = result.summary;
    level2 = [
      { key: 'revenue', label: { en: 'Revenue', zh: '营收' }, valueFen: s.revenue, sharePct: null },
      ...(['productCost', 'advertising', 'influencerCommission', 'delivery', 'refunds', 'platformFees'] as const).map(
        (k) => ({
          key: `cost:${k}`,
          label: METRIC_DEFS[k].label,
          valueFen: s[k],
          sharePct: s.revenue > 0 ? Math.round((s[k] / s.revenue) * 10000) / 100 : null
        })
      )
    ];
  } else {
    // cost metrics decompose into their top source records' channel split
    const field = input.metric === 'advertising' ? 'advertising' : input.metric;
    level2 = result.byChannel
      .map((c) => {
        const value = field === 'advertising' ? (c.advertising ?? 0) : c[field as 'delivery'];
        return {
          key: `channel:${c.key}`,
          label: { en: c.label, zh: c.label },
          valueFen: value,
          sharePct: result.summary[field as 'delivery'] > 0 ? Math.round((value / result.summary[field as 'delivery']) * 10000) / 100 : null
        };
      })
      .filter((c) => c.valueFen > 0);
  }

  // Level 3 raw refs — engine metric ids map onto different order fields
  let level3: EvidenceRef[];
  const orderFieldFor: Partial<Record<MetricId, 'grossAmount' | 'commission' | 'deliveryCost' | 'refundAmount' | 'platformFee'>> = {
    revenue: 'grossAmount',
    influencerCommission: 'commission',
    delivery: 'deliveryCost',
    refunds: 'refundAmount',
    platformFees: 'platformFee'
  };
  const amountOf = (o: EngineOrder): Fen => {
    if (input.metric === 'realProfit') {
      return o.grossAmount - o.commission - o.deliveryCost - o.refundAmount - o.platformFee;
    }
    const field = orderFieldFor[input.metric];
    return field ? o[field] : 0; // productCost per-order needs unit price; product metrics use ad/order lists below
  };
  if (input.metric === 'advertising') {
    level3 = [...input.adSpend]
      .sort((a, b) => b.spend - a.spend || a.id.localeCompare(b.id))
      .slice(0, LEVEL3_CAP)
      .map((a) => ({ type: 'AD', id: a.id, label: `${a.campaign} · ${a.channel}`, amountFen: a.spend, dateISO: a.date }));
  } else {
    level3 = [...input.orders]
      .filter((o) => o.status === 'COMPLETED' || o.status === 'REFUNDED')
      .sort((a, b) => amountOf(b) - amountOf(a) || a.id.localeCompare(b.id))
      .slice(0, LEVEL3_CAP)
      .map((o) => ({
        type: 'ORDER',
        id: o.id,
        label: `#${o.externalId} · ${o.channel}`,
        amountFen: amountOf(o),
        dateISO: o.orderedAt
      }));
  }

  const valueFen =
    input.metric === 'realProfit' ? result.summary.realProfit : result.summary[input.metric as 'delivery'];

  return {
    metric: input.metric,
    level1: { label: def.label, valueFen, formula: def.formula, periodLabel: input.periodLabel },
    level2,
    level3,
    warnings
  };
}
