# Security Self-Assessment — XiaoCai AI

Last reviewed: 2026-10-19. Scope: the prototype in this repository, deployed as a
single API instance + single web instance on managed Postgres (Neon).

This is a **self-assessment**, not a third-party audit. It records what is
implemented, the evidence used to verify it, and the residual risks that remain
before a real production launch (see `RISK_REGISTER.md`).

## The four pillars

### 1. Authentication & session security

| Control | Implementation | Verified by |
|---|---|---|
| Password hashing | bcrypt, cost 10 (`lib/password.ts`) | `tests/password.test.ts` |
| Password policy | ≥8 chars, ≥1 letter + ≥1 digit, ≤128 (`routes/auth.ts`) | `tests/integration/auth.test.ts` |
| Session token | HS256 JWT in an **httpOnly**, SameSite=Lax cookie; 7-day TTL; `secure` in production | live smoke + integration tests |
| Server-side revocation | Every JWT carries `jti` = `Session.id`; `requireAuth` rejects revoked/missing sessions; logout revokes the row | `logout invalidates the session` integration test |
| Login throttling | 10 attempts / 15 min per IP (`loginLimiter`) | `returns 429 after too many failed attempts` |
| Account lockout | 5 consecutive failures → 15-minute lock (instance-local) | `auth.ts`; documented as R5 |
| Session fixation | Login always creates a new `Session` row and a new JWT | code review |

### 2. Authorization & tenant isolation

| Control | Implementation | Verified by |
|---|---|---|
| Roles | `OWNER` / `ACCOUNTANT` / `VIEWER`; `requireRole` on every mutating route | `tests/integration/roles-isolation.test.ts` |
| Approval authority | Only `OWNER` may decide an approval | roles-isolation test |
| Audit access | `OWNER`/`ACCOUNTANT` only | roles-isolation test |
| Imports | `OWNER`/`ACCOUNTANT` only | roles-isolation test |
| Cross-tenant access | Every query filters by `businessId`; foreign IDs return **404**, never 403-or-data | `returns 404 for another business's approval` |
| Revoked sources | Excluded at the single `getAuthorisedData` boundary, so no financial number can include revoked data | financials integration test |
| Demo isolation | Each demo visit clones into a private business; clone password is random and never returned | `routes/demo.ts`; manual smoke |

### 3. Input & output safety

| Control | Implementation | Verified by |
|---|---|---|
| Input validation | Zod on every body/query/param; unknown metrics return 404 | code + integration tests |
| CSRF | Double-submit token: `xc_csrf` cookie must equal `x-csrf-token` header on all non-GET `/api` routes | `auth.test.ts` (missing/mismatched token → 403) |
| Security headers | Helmet (CSP, HSTS, nosniff, frame-deny, etc.) | live smoke response headers |
| CORS | Explicit allow-list from `WEB_ORIGIN`, credentials enabled | `app.ts` |
| Upload limits | CSV only, 1 file, 5 MB, 5,000 rows | `services/csv.ts` + `routes/imports.ts` |
| CSV formula injection | Cells beginning `= + - @` / control chars are prefixed with `'` on export | `tests/csv.test.ts` |
| SQL injection | Prisma parameterized queries only | code review |
| XSS | React escapes by default; no `dangerouslySetInnerHTML` | code review |
| Prompt injection | User text reaches the LLM only as untrusted data inside a fixed extraction prompt; answers are number-guarded | `ai/parseWhatIf.ts`, `ai/explain.ts` |
| Error leakage | Central error handler returns codes/messages, not stack traces | `middleware/error.ts` |

### 4. Auditability & integrity

| Control | Implementation | Verified by |
|---|---|---|
| Append-only log | Application exposes no update/delete path for `AuditLog` | code review |
| Coverage | Auth events, data reads, imports, source grant/revoke, scenario saves, recommendation/approval decisions, exports, assistant asks | integration tests |
| Tamper evidence | Hash chain: `hash = SHA-256(prevHash ‖ canonical row)`; `GET /api/audit/integrity` verifies | `imports-audit.test.ts` (valid chain + detected tamper) |
| PII minimisation | Audit metadata never contains emails/names; request logs redact cookies, auth headers, passwords and emails | `lib/logger.ts`, `app.ts` |

## Verified commands

```bash
npm run lint && npm run typecheck && npm test && npm run test:integration && npm run build
```

All green at the time of writing (80 unit tests + 25 integration tests).

## Residual risks (summary — details in RISK_REGISTER.md)

- **R1** AI explanation could still be wrong in wording; numbers are guarded, advice may not fit the business.
- **R2** Garbage-in: valid-looking CSV rows can be wrong; forecasts inherit user data quality.
- **R3** Forecast is a deterministic simplification (no seasonality, tax, FX or credit-line dynamics).
- **R4** Audit hash chain serialisation is per-instance; multi-instance needs a DB advisory lock.
- **R5** Rate limits and account lockout use in-memory stores; multi-instance needs a shared store (Redis).

## Out of scope for this prototype

Penetration testing, WAF/DDoS, secret rotation automation, SOC 2 / ISO 27001
certification, email verification, password reset, MFA, and real bank/platform
OAuth connections.
