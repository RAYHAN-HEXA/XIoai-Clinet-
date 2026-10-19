import type { EngineAdSpend, EngineOrder, EngineProduct } from '../src/types';

/** The deck anchor: ¥100,000 revenue → ¥5,000 real profit (5% margin). */
export function anchorInput(): { orders: EngineOrder[]; adSpend: EngineAdSpend[]; products: EngineProduct[] } {
  const product: EngineProduct = { id: 'p1', sku: 'DRESS-01', name: 'Autumn dress', unitCost: 625_000 };
  const orders: EngineOrder[] = [1, 2, 3, 4].map((i) => ({
    id: `o${i}`,
    channel: 'douyin',
    externalId: `10000${i}`,
    productId: 'p1',
    orderedAt: '2026-01-05T10:00:00.000Z',
    grossAmount: 2_500_000,
    platformFee: 125_000,
    commission: 500_000,
    deliveryCost: 300_000,
    refundAmount: i === 1 ? 800_000 : 0,
    status: 'COMPLETED' as const
  }));
  const adSpend: EngineAdSpend[] = [
    { id: 'a1', channel: 'douyin', campaign: 'autumn-launch', date: '2026-01-03', spend: 2_500_000, attributedRevenue: 4_000_000 }
  ];
  return { orders, adSpend, products: [product] };
}
