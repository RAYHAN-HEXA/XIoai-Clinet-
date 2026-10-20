# Data Flow — XiaoCai AI

The governing rule is **"Data in. Math decides. AI explains."** This document
shows every hop a number takes, and where the LLM is (and is not) allowed.

## 1. Data ingestion

```
CSV upload / seeded demo data
        │
        ▼
POST /api/imports/:kind/preview     parse → auto-map → validate (no writes)
        │                           row-level errors returned
        ▼
POST /api/imports/:kind             re-validate with confirmed mapping
        │                           dedupe orders by (channel, externalId)
        ▼
Postgres tables: Order, Settlement, AdSpend, SupplierInvoice,
                 DataSource, Product, ImportJob
```

- Money is parsed from yuan at the boundary and stored as **integer fen**.
- Dates are normalised to calendar dates / UTC instants at the boundary.
- Each import writes an `ImportJob` and an `IMPORT` audit entry.
- Every import of 5,000+ rows, non-CSV files and oversize files is rejected.

## 2. Authorised read boundary

```
Postgres ──► getAuthorisedData(businessId, {from,to})
                 │  • filters strictly by businessId
                 │  • excludes rows belonging to REVOKED data sources
                 │  • returns typed Engine* objects (fen, ISO dates)
                 ▼
        packages/engine (pure, deterministic, no I/O)
```

`getAuthorisedData` is the **only** raw-table path used by financial engines.
Routes do not query financial tables directly to compute numbers.

## 3. Deterministic engine

```
Engine inputs ──► trueProfit()       → revenue, costs, realProfit, groupings, meta
              ──► profitDrivers()    → reconciling period-over-period drivers
              ──► cashForecast()     → 30-day daily balances, first shortage day
              ──► applyScenario()    → stressed forecast (what-if)
              ──► financingMatcher() → qualitative options for a gap
              ──► buildEvidenceTree()→ drill-down from a headline to rows
              ──► dailyBriefData()   → owner brief data
```

The engine is a pure TypeScript package: no database, no clock, no network, no
LLM. All math and rounding happen here. Unit tests cover the contract examples
(¥100,000 → ¥5,000 profit; stressed shortage on day 12).

## 4. API responses

```
engine result ──► Express route (Zod-validated request)
                    │  • writes a DATA_ACCESS / decision audit entry
                    │  • attaches completeness + assumptions
                    ▼
              JSON (fen) ──► Next.js web app
                               │
                               ▼
                        formatted at display only (¥ = fen / 100)
```

## 5. AI path (optional)

```
User question
     │  (only the question string; never CSV contents or the whole DB)
     ▼
parseWhatIf(provider, question)
     │  • fixed extraction prompt, question treated as untrusted data
     │  • output validated by Zod and clamped to engine limits
     ▼
applyScenario(spec, params)        ← the ENGINE computes every number
     │
     ▼
explain(provider, engineJson, templateFallback)
     │  • number guard: every figure in the answer must appear in engineJson
     │  • on any failure → deterministic localized template
     ▼
Answer + scenario + financing options (disclaimer attached)
```

With `ANTHROPIC_API_KEY` unset the provider is a no-op; `/api/assistant/ask`
returns a template response and the rest of the product is unaffected.

## 6. Sessions and audit

```
register/login/demo ──► Session row (jti) + httpOnly JWT cookie
                         + CSRF cookie/header pair
request ──► requireAuth (JWT verify + Session not revoked + user re-fetch)
       ──► csrfProtection (mutations)
       ──► route handler ──► writeAudit (hash-chained, append-only)
```

`writeAudit` serialises writes per business in-process, computes
`sha256(prevHash ‖ canonical row)` and stores the result. `GET
/api/audit/integrity` recomputes the chain and reports the first broken row.

## 7. Demo cloning

```
POST /api/auth/demo
   1. purge clones older than 24 h
   2. find canonical seeded demo business (isDemo, no clone suffix)
   3. copy sources, products, orders, ads, invoices, settlements,
      recommendations and approvals into a new business
      ("… (Demo clone)")
   4. create a user with a random, never-returned password
   5. create a Session + cookie, write DEMO_SESSION audit
```

Visitor changes (imports, approvals, source revocations, scenarios) stay inside
their clone and cascade-delete when the clone is purged.
