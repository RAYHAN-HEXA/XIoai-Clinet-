# Financial Methodology — XiaoCai AI

All amounts are integer **fen** (¥1 = 100 fen). Rounding happens only at the
edges (percentages to 2 dp). The engine is pure: same inputs → same outputs,
regardless of time, machine or LLM.

## 1. True Profit

For a period, using only authorised orders and ad rows:

```
Revenue            = Σ grossAmount        (status COMPLETED or REFUNDED)
Product cost       = Σ product.unitCost   (one unit per order line; unmapped → 0, disclosed)
Advertising        = Σ adSpend.spend      (all rows in period)
Commission         = Σ order.commission   (influencer / affiliate)
Delivery           = Σ order.deliveryCost
Refunds            = Σ order.refundAmount
Platform fees      = Σ order.platformFee

Total costs        = product + advertising + commission + delivery + refunds + fees
Real profit        = Revenue − Total costs
Margin %           = round2(Real profit / Revenue × 100)   (null when Revenue = 0)
```

Design choices, each disclosed in the API `meta.notes`:

- **REFUNDED orders keep their gross revenue**; the refund appears as a cost
  line. This avoids pretending the sale never happened.
- **PENDING and CANCELLED orders are excluded** from profit; their counts are
  reported separately.
- **One unit per order line** is assumed. Multi-unit orders are not modelled in
  the prototype; unmapped products contribute no product cost rather than an
  invented estimate.
- Every cost is counted **once** in the summary. Groupings are views:
  - `byChannel` allocates advertising by channel and reconciles to real profit.
  - `byProduct` **excludes** advertising because per-product attribution is
    unknown — this limitation is explicit, not hidden.
  - `byCampaign` reports ROAS = attributedRevenue / spend (null when spend = 0).

### Contract check

An order with gross ¥100,000, no other costs, and a product cost of ¥95,000
yields **real profit ¥5,000** and **margin 5%**. This is reproduced in the
engine unit tests and through the API integration test.

## 2. Profit drivers (period-over-period)

Contributions are defined so they reconcile **exactly**:

```
revenue contribution = current.revenue − previous.revenue
cost contribution    = −(current.cost − previous.cost)
Σ contributions      = current.realProfit − previous.realProfit
```

Percent differences are `null` when the previous value is zero (no “+∞%”).
Drivers are ranked by absolute contribution. Each driver carries up to 10
evidence references (orders, ad rows, invoices) for drill-down.

## 3. Cash forecast

A deterministic 30-day daily balance:

```
balance(day d) = balance(d−1) + inflow(d) − outflow(d)
inflow(d)      = sales of day (d − settlementDelayDays)    (≥ day 1 only)
                 + explicit known inflows (pending settlements)
outflow(d)     = adSpendPerDay + fixedCostsPerDay
                 + supplier obligations due that day
```

- Overdue obligations (and missing-document invoices) are treated as due on
  **day 1** — they must be paid now.
- `firstShortageDay` = the first day with balance < 0, else **null**. A
  no-shortage result is explicit; the API never invents a date.
- `minBalanceDay/Fen` and `closingBalanceFen` are always reported.
- Alert levels: `CRITICAL` (shortage within 7 days), `WARNING` (shortage later in
  the window), `WATCH` (no shortage but the floor is below one week of typical
  outflows), `NONE`.
- Negative balances are **not** silently floored at zero; the size of the gap is
  real and visible.

### Live spec derivation

`buildBaseForecastSpec` derives the spec from authorised data:

| Field | Derivation |
|---|---|
| `openingCashFen` | `Business.openingCash` (owner-set book value) |
| `dailySalesFen` | last 30 days’ authorised GMV ÷ 30 |
| `adSpendPerDayFen` | last 30 days’ authorised ad spend ÷ 30 |
| `settlementDelayDays` | 5 (consistent platform payout lag; documented constant) |
| `supplierObligations` | DUE / OVERDUE / MISSING_DOC invoices (PAID excluded), due-days computed as **calendar** days |
| `extraInflows` | PENDING settlements expected within 30 days |
| `fixedCostsPerDayFen` | 0 in the prototype (disclosed) |

Calendar-day math is deliberate: a due date is a whole-day concept. Using
instant math shifted 12-day obligations to day 11 depending on time of day.

### Demo anchor

- Opening cash ¥60,000; sales ¥6,000/day settling after 5 days; supplier
  ¥40,000 due day 6 and ¥50,000 due day 12; ads ¥800/day.
- **Base:** no shortage (minimum ¥2,400 on day 12).
- **Stress:** sales −20%, supplier cost +10%, settlement delay +5 days →
  **first shortage on day 12.**

Both are covered by engine unit tests and by the live-data integration test.

The engine unit tests use fixed inputs, so the day-12 result is deterministic and
time-independent. On **live seeded data**, obligation due-days are calendar-day
differences from the request date, so an invoice seeded "12 days out" is read as
day 12 on the day it is seeded and day 11 the next UTC day. This is correct
behaviour (a due date is an absolute calendar date), not an engine defect: the
shortage always lands on the **due day of the invoice that breaches cash**. Re-run
`npm run db:seed` on the day of a demo to restore the intended offsets.

## 4. Scenarios / what-if

`salesChangePct`, `supplierCostChangePct`, `settlementDelayDays` and
`adSpendChangePct` are clamped to safe ranges (percent −80..+200, delay 0..60).
Known scheduled inflows (e.g. pending settlements) are **not** scaled by
scenarios — they are known receipts. The result is recomputed by the same
`cashForecast` function; nothing is estimated in the browser.

## 5. Financing options

`financingMatcher` returns up to four **qualitative** categories (supplier terms,
settlement advance, merchant working capital, bank SME loan). It ranks them by
fit to the gap and reason, lists documents to prepare and risks to check, and
attaches a disclaimer.

It deliberately does **not** show interest rates, limits or approval chances,
because no verified lender feed is connected. XiaoCai never applies for credit
or contacts a lender.

## 6. Evidence trees

`buildEvidenceTree(metric)` walks from a headline figure to its constituent
orders/invoices/ads, capped and sorted by amount, with source labels. This is how
the UI answers “where did this number come from?” without asking an LLM.

## 7. What this model is not

Not a statutory accounting statement, not tax advice, not a credit decision, and
not a substitute for reconciled platform statements. It does not model
seasonality, VAT, FX, chargebacks, inventory turns or credit-line covenants.
Assumptions are returned with the data so the owner can judge fit.
