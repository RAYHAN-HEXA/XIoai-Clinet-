# Risk Register — XiaoCai AI

| ID | Risk | Likelihood | Impact | Mitigation in this build | Remaining exposure | Owner |
|---|---|---|---|---|---|---|
| **R1** | AI explanation states something misleading, even though numbers are correct | Medium | High | Numbers are computed only by the engine; `explain()` rejects any figure not present in the engine payload; deterministic localized templates are the fallback; LLM is optional | Wording/advice can still be generic or unsuitable; templates are not personalised financial advice | Product |
| **R2** | Bad data in (wrong but valid-looking CSV) produces confident wrong forecasts | Medium | High | Preview → validate → confirm flow, row-level errors, duplicate detection, completeness/assumption metadata, revoked-source exclusion | A user can still confirm values that are semantically wrong; no reconciliation against platform APIs | Product / Data |
| **R3** | Forecast model is too simple for real decisions (no seasonality, tax, FX, credit lines, one-unit-per-order assumption) | High | Medium | Assumptions are returned with every forecast; UI labels scenarios "hypothetical"; no rate/eligibility claims in financing | Owners may over-trust a 30-day deterministic curve | Product |
| **R4** | Audit hash chain can fork under multiple API instances writing for the same business concurrently | Low (single instance) | Medium | In-process per-business promise chain makes writes race-free within one instance; `GET /api/audit/integrity` detects a broken chain | Multi-instance deployment needs a DB advisory lock or a queue | Engineering |
| **R5** | Rate limits and account lockout are per-instance and reset on restart | Medium | Medium | Limits are on by default; failed-login audit trail records attempts; lockout is time-bounded | Horizontal scaling or restarts weaken throttling; move to Redis/shared store | Engineering |
| **R6** | Demo clone purge is best-effort; failed deletes leave stale clone data | Low | Low | Clones are isolated by business; delete failures never block a demo; canonical dataset untouched | Storage growth and stale demo rows until a later purge succeeds | Engineering |
| **R7** | No MFA, email verification or password reset | Medium | Medium | Strong-ish password policy, bcrypt, lockout, server-side session revocation | Account takeover via credential stuffing not fully mitigated; no recovery path | Product / Security |
| **R8** | Secrets (DB URL, JWT secret, LLM key) are environment variables; no rotation tooling | Medium | High | `.env` is gitignored; `.env.example` contains fake values only; no secrets in logs | A leaked env compromises sessions/data; rotation is manual | Engineering / Ops |
| **R9** | CSV export/import formula injection | Low | Medium | Export prefix-sanitises cells starting with `= + - @` or control chars (`sanitizeCsvCell`, unit-tested) | Other export surfaces added later must reuse the helper | Engineering |
| **R10** | Browser download unavailable in CI, so Playwright E2E cannot run there | Medium | Low | Supertest integration suite covers the same workflows at the HTTP layer; E2E specs ship for local runs | Regressions that only manifest in the browser may be missed | Engineering |

## Review cadence

Re-review this register at every phase boundary and before any real deployment.
Risks R4, R5, R7 and R8 are **blockers** for a multi-instance production launch.
