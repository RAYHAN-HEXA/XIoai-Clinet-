import { type BaseForecastSpec, type SupplierObligation, daysBetween } from '@xiaocai/engine';
import { getAuthorisedData } from './authorized-data';
import { prisma } from '../lib/prisma';

/**
 * Builds the BASE 30-day forecast spec from the business's AUTHORIZED data.
 *
 * Documented modeling choices (docs/FINANCIAL_METHODOLOGY.md):
 *  - dailySalesFen  = gross GMV of the last 30 days ÷ 30 (authorized orders only)
 *  - adSpendPerDayFen = ad spend of the last 30 days ÷ 30
 *  - settlementDelayDays = 5 — the platform payout lag used consistently in the
 *    seed and engine demo constants; real per-order lags live in Order data
 *  - supplier obligations: DUE/OVERDUE/MISSING_DOC invoices (PAID excluded),
 *    with the ¥90,000 demo layout landing on days 6 and 12
 *  - extraInflows: PENDING settlements expected within the horizon
 *  - openingCash comes from Business.openingCash (owner-adjustable book value)
 */
export const SETTLEMENT_DELAY_DAYS = 5;
export const HORIZON_DAYS = 30;

export async function buildBaseForecastSpec(businessId: string, now: Date = new Date()): Promise<BaseForecastSpec> {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { openingCash: true }
  });
  const from = new Date(now.getTime() - HORIZON_DAYS * 86_400_000);
  const data = await getAuthorisedData(businessId, { from, to: now });

  const gmv30 = data.orders
    .filter((o) => o.status === 'COMPLETED' || o.status === 'REFUNDED')
    .reduce((sum, o) => sum + o.grossAmount, 0);
  const ads30 = data.adSpend.reduce((sum, a) => sum + a.spend, 0);

  const obligations: SupplierObligation[] = data.supplierInvoices
    .filter((i) => i.status !== 'PAID')
    .map((i) => ({
      id: i.id,
      label: i.label,
      dueInDays: daysBetween(now.toISOString(), `${i.dueDate}T00:00:00.000Z`),
      amountFen: i.amountFen,
      status: i.status
    }));

  const extraInflows = await prisma.settlement
    .findMany({
      where: {
        businessId,
        status: 'PENDING',
        expectedDate: { gte: now, lte: new Date(now.getTime() + HORIZON_DAYS * 86_400_000) }
      },
      orderBy: { expectedDate: 'asc' }
    })
    .then((rows) =>
      rows.map((s, idx) => ({
        id: s.id,
        label: `Settlement · ${s.channel}`,
        dayOffset: Math.max(1, Math.round((s.expectedDate.getTime() - now.getTime()) / 86_400_000) + idx * 0),
        amountFen: s.amount
      }))
    );

  return {
    openingCashFen: business.openingCash,
    asOfISO: now.toISOString(),
    horizonDays: HORIZON_DAYS,
    dailySalesFen: Math.round(gmv30 / HORIZON_DAYS),
    settlementDelayDays: SETTLEMENT_DELAY_DAYS,
    supplierObligations: obligations,
    adSpendPerDayFen: Math.round(ads30 / HORIZON_DAYS),
    fixedCostsPerDayFen: 0,
    extraInflows
  };
}
