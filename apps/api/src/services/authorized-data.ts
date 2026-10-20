import type { AdSpend, Order, SupplierInvoice } from '@prisma/client';
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

/** Map a date window onto the `where` clause of a Prisma date field. */
function dateWindow(field: 'orderedAt' | 'date', opts: AuthorisedDataOptions) {
  if (!opts.from && !opts.to) return {};
  return {
    [field]: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) }
  };
}

function toEngineOrder(o: Order): EngineOrder {
  return {
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
  };
}

function toEngineAdSpend(a: AdSpend): EngineAdSpend {
  return {
    id: a.id,
    channel: a.channel,
    campaign: a.campaign,
    date: a.date.toISOString(),
    spend: a.spend,
    attributedRevenue: a.attributedRevenue,
    sourceId: a.sourceId
  };
}

function toEngineInvoice(i: SupplierInvoice): EngineSupplierInvoice {
  return {
    id: i.id,
    label: i.supplierName,
    dueDate: i.dueDate.toISOString().slice(0, 10),
    amountFen: i.amount,
    status: i.status
  };
}

/**
 * Loads several date windows in ONE round trip: the unbounded tables
 * (sources, products, supplierInvoices) are fetched once and shared across
 * windows, so N windows cost 3 + 2N queries in a single parallel wave
 * instead of N separate fetches of 2 waves each.
 */
export async function getAuthorisedDataMany(
  businessId: string,
  ranges: AuthorisedDataOptions[]
): Promise<AuthorisedData[]> {
  const orderQueries = ranges.map((opts) =>
    prisma.order.findMany({
      where: { businessId, ...dateWindow('orderedAt', opts) },
      orderBy: { orderedAt: 'asc' }
    })
  );
  const adQueries = ranges.map((opts) =>
    prisma.adSpend.findMany({
      where: { businessId, ...dateWindow('date', opts) },
      orderBy: { date: 'asc' }
    })
  );

  const [sources, products, supplierInvoices, ordersPerRange, adsPerRange] = await Promise.all([
    prisma.dataSource.findMany({
      where: { businessId },
      select: { id: true, status: true }
    }),
    prisma.product.findMany({ where: { businessId } }),
    prisma.supplierInvoice.findMany({ where: { businessId }, orderBy: { dueDate: 'asc' } }),
    Promise.all(orderQueries),
    Promise.all(adQueries)
  ]);

  const revoked = new Set(sources.filter((s) => s.status === 'REVOKED').map((s) => s.id));

  const sharedProducts: EngineProduct[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    unitCost: p.unitCost
  }));
  const sharedInvoices: EngineSupplierInvoice[] = supplierInvoices.map(toEngineInvoice);

  return ranges.map((_, i) => ({
    orders: (ordersPerRange[i] ?? [])
      .filter((o) => !o.sourceId || !revoked.has(o.sourceId))
      .map(toEngineOrder),
    adSpend: (adsPerRange[i] ?? [])
      .filter((a) => !a.sourceId || !revoked.has(a.sourceId))
      .map(toEngineAdSpend),
    products: sharedProducts,
    supplierInvoices: sharedInvoices,
    revokedSourceCount: revoked.size
  }));
}

/**
 * Narrows an already-loaded window in memory instead of paying another
 * round trip: only orders/adSpend are date-bounded (products and
 * supplierInvoices are fetched unbounded), so slicing an existing load is
 * exactly equivalent to re-querying with a narrower window.
 */
export function filterToRange(data: AuthorisedData, opts: AuthorisedDataOptions): AuthorisedData {
  const fromIso = opts.from?.toISOString();
  const toIso = opts.to?.toISOString();
  const inRange = (iso: string): boolean => (!fromIso || iso >= fromIso) && (!toIso || iso <= toIso);
  return {
    ...data,
    orders: fromIso || toIso ? data.orders.filter((o) => inRange(o.orderedAt)) : data.orders,
    adSpend: fromIso || toIso ? data.adSpend.filter((a) => inRange(a.date)) : data.adSpend
  };
}

export async function getAuthorisedData(
  businessId: string,
  opts: AuthorisedDataOptions = {}
): Promise<AuthorisedData> {
  const rows = await getAuthorisedDataMany(businessId, [opts]);
  return rows[0]!;
}
