import { prisma } from '../lib/prisma';
import type {
  EngineAdSpend,
  EngineOrder,
  EngineProduct,
  EngineSupplierInvoice
} from '@xiaocai/engine';

/**
 * THE single path from raw tables to the financial engines.
 * Everything the engine sees passes through here so that REVOKED data sources
 * stop contributing immediately (orders/ads whose source is revoked are
 * excluded; imported rows without a source are owner-authorized by definition).
 * Nothing else in the codebase may query Order/AdSpend for engine input.
 */

export interface AuthorisedData {
  orders: EngineOrder[];
  adSpend: EngineAdSpend[];
  products: EngineProduct[];
  supplierInvoices: EngineSupplierInvoice[];
  revokedSourceCount: number;
}

export interface AuthorisedDataOptions {
  /** inclusive ISO datetime bounds on orders.orderedAt / adSpend.date */
  from?: Date;
  to?: Date;
}

export async function getAuthorisedData(businessId: string, opts: AuthorisedDataOptions = {}): Promise<AuthorisedData> {
  const sources = await prisma.dataSource.findMany({
    where: { businessId },
    select: { id: true, status: true }
  });
  const revoked = new Set(sources.filter((s) => s.status === 'REVOKED').map((s) => s.id));

  const [orders, adSpend, products, supplierInvoices] = await Promise.all([
    prisma.order.findMany({
      where: {
        businessId,
        ...(opts.from || opts.to ? { orderedAt: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } } : {})
      },
      orderBy: { orderedAt: 'asc' }
    }),
    prisma.adSpend.findMany({
      where: {
        businessId,
        ...(opts.from || opts.to ? { date: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } } : {})
      },
      orderBy: { date: 'asc' }
    }),
    prisma.product.findMany({ where: { businessId } }),
    prisma.supplierInvoice.findMany({ where: { businessId }, orderBy: { dueDate: 'asc' } })
  ]);

  return {
    orders: orders
      .filter((o) => !o.sourceId || !revoked.has(o.sourceId))
      .map((o) => ({
        id: o.id,
        channel: o.channel,
        externalId: o.externalId,
        productId: o.productId,
        orderedAt: o.orderedAt.toISOString(),
        grossAmount: o.grossAmount,
        platformFee: o.platformFee,
        commission: o.commission,
        deliveryCost: o.deliveryCost,
        refundAmount: o.refundAmount,
        status: o.status,
        sourceId: o.sourceId
      })),
    adSpend: adSpend
      .filter((a) => !a.sourceId || !revoked.has(a.sourceId))
      .map((a) => ({
        id: a.id,
        channel: a.channel,
        campaign: a.campaign,
        date: a.date.toISOString(),
        spend: a.spend,
        attributedRevenue: a.attributedRevenue,
        sourceId: a.sourceId
      })),
    products: products.map((p) => ({ id: p.id, sku: p.sku, name: p.name, unitCost: p.unitCost })),
    supplierInvoices: supplierInvoices.map((i) => ({
      id: i.id,
      label: i.supplierName,
      dueDate: i.dueDate.toISOString().slice(0, 10),
      amountFen: i.amount,
      status: i.status
    })),
    revokedSourceCount: revoked.size
  };
}
