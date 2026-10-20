import { type BaseForecastSpec, type SupplierObligation } from '@xiaocai/engine';
import { getAuthorisedData, type AuthorisedData } from './authorized-data';
import { prisma } from '../lib/prisma';

/**
 * Calendar-day difference (UTC), not an instant difference: invoices carry a
 * date (YYYY-MM-DD) and a due "in N days" is a whole-day concept. Using
 * instant math here would shift a due date by one day depending on the time
 * of day the forecast is built (e.g. a 12-day obligation read as 11).
 */
export function calendarDaysBetween(from: Date, toISO: string): number {
  const to = new Date(`${toISO}T00:00:00.000Z`);
  const fromUtc = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const toUtc = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

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

export interface PendingSettlementRow {
  id: string;
  channel: string;
  expectedDate: Date;
  amount: number;
}

/** The three inputs the spec is composed from — fetchable in ONE parallel wave. */
export interface SpecParts {
  openingCashFen: number;
  data: AuthorisedData;
  settlements: PendingSettlementRow[];
}

/**
 * Pure composition step: builds the spec from already-loaded parts so that
 * callers who fetched the 30-day window for another purpose can reuse it
 * instead of paying for a second identical fetch.
 */
export function composeBaseForecastSpec(now: Date, parts: SpecParts): BaseForecastSpec {
  const { openingCashFen, data, settlements } = parts;

  const gmv30 = data.orders
    .filter((o) => o.status === 'COMPLETED' || o.status === 'REFUNDED')
    .reduce((sum, o) => sum + o.grossAmount, 0);
  const ads30 = data.adSpend.reduce((sum, a) => sum + a.spend, 0);

  const obligations: SupplierObligation[] = data.supplierInvoices
    .filter((i) => i.status !== 'PAID')
    .map((i) => ({
      id: i.id,
      label: i.label,
      dueInDays: calendarDaysBetween(now, i.dueDate),
      amountFen: i.amountFen,
      status: i.status
    }));

  const extraInflows = settlements.map((s, idx) => ({
    id: s.id,
    label: `Settlement · ${s.channel}`,
    dayOffset: Math.max(1, Math.round((s.expectedDate.getTime() - now.getTime()) / 86_400_000) + idx * 0),
    amountFen: s.amount
  }));

  return {
    openingCashFen,
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

/** PENDING settlements expected inside the horizon — spec extraInflows input. */
export async function fetchPendingSettlements(
  businessId: string,
  now: Date = new Date()
): Promise<PendingSettlementRow[]> {
  return prisma.settlement.findMany({
    where: {
      businessId,
      status: 'PENDING',
      expectedDate: { gte: now, lte: new Date(now.getTime() + HORIZON_DAYS * 86_400_000) }
    },
    orderBy: { expectedDate: 'asc' }
  });
}

/** Loads openingCash + pending settlements + (unless provided) the 30-day window in one wave. */
export async function fetchSpecParts(
  businessId: string,
  now: Date = new Date(),
  data?: AuthorisedData
): Promise<SpecParts> {
  const from = new Date(now.getTime() - HORIZON_DAYS * 86_400_000);
  const [business, settlements, loaded] = await Promise.all([
    prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { openingCash: true }
    }),
    fetchPendingSettlements(businessId, now),
    data ?? getAuthorisedData(businessId, { from, to: now })
  ]);
  return { openingCashFen: business.openingCash, data: loaded, settlements };
}

export async function buildBaseForecastSpec(
  businessId: string,
  now: Date = new Date(),
  data?: AuthorisedData
): Promise<BaseForecastSpec> {
  return composeBaseForecastSpec(now, await fetchSpecParts(businessId, now, data));
}
