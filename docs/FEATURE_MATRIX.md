# Feature Matrix — XiaoCai AI

Status legend: ✅ verified complete · 🟢 implemented, verification pending · 🟡 partial · ❌ missing

Updated: 2026-10-20 (post build-out + verification pass)

## Backend / data

| Feature | Status | Notes |
|---|---|---|
| Register (Business + OWNER atomic) | ✅ | integration tests: 201/400/409/mismatch; confirmation-password server-validated |
| Login / logout / me | ✅ | E2E + integration; session revoked server-side on logout |
| JWT httpOnly session cookie | ✅ | HS256, 7d, jti-bound to a Session row |
| Login rate limit (10 fails/15min) | ✅ | 429 verified in integration |
| Server-side session revocation | ✅ | Session row + requireAuth re-checks jti |
| CSRF double-submit | ✅ | integration test: 403 without header, allowed with |
| Roles OWNER/ACCOUNTANT/VIEWER enforced per-endpoint | ✅ | roles-isolation.test.ts: VIEWER cannot mutate/import/audit |
| 13-model schema, money in fen, indexes | ✅ | migrations `0_init`, `1_sessions_audit_chain` |
| Audit log (append-only + hash chain) | ✅ | integrity endpoint + E2E "Hash chain verified" |
| /health with DB check | ✅ | 200/503 |
| Neon-over-443 driver (auto) | ✅ | verified live |
| Engine `@xiaocai/engine` | ✅ | 90 unit tests; ¥100k→¥5k + Day-12 anchors |
| `getAuthorisedData(businessId)` | ✅ | revoked sources excluded (integration tested) |
| Seed (Ms. Li, GMV ¥180k, ~600 orders) | ✅ | deterministic, isDemo=true, repeatable |
| CSV import (orders/settlements/ads/invoices) | ✅ | preview/confirm/templates/history, row errors, dedupe, formula-injection safe |
| Sources grant/revoke API | ✅ | audited, business-scoped |
| Profit/cash/financing/evidence/brief APIs | ✅ | Zod-validated, paginated, role-gated |
| Recommendations + approvals API | ✅ | OWNER-only decision, duplicate-decision 409 |
| Audit API + CSV export | ✅ | formula-injection-sanitized export |
| AI parseWhatIf / explain with number guard | ✅ | `tests/ai-guard.test.ts` proves fabricated values are discarded |

## Frontend

| Feature | Status | Notes |
|---|---|---|
| Landing / login / register | ✅ | demo CTA, safe `?next=`, confirm-password + strength meter |
| Dashboard | ✅ | real API data, insights, alerts, freshness, demo banner, empty states |
| Sidebar 10 destinations | ✅ | all real screens |
| EN/中文 i18n | ✅ | cookie locale; check-i18n guard (392 keys × 2) |
| Route guard middleware | ✅ | |
| True Profit / Drivers / Simulator / Financing / Brief / Approvals / Sources / Audit / Security screens | ✅ | connected to real APIs |
| EvidenceNumber drill-down | ✅ | evidence drawers on figures |
| Mobile drawer ≤360px | ✅ | sidebar drawer + responsive tables/charts |

## Quality

| Item | Status |
|---|---|
| Engine unit tests | ✅ 90 tests (trueProfit/drivers/cash/financing/evidence/brief) |
| API unit tests | ✅ 23 (jwt/password/csv/ai-guard) |
| API integration tests | ✅ 26 (auth/roles/financials/imports/audit) |
| Playwright e2e | ✅ Workflow A + B pass |
| CI workflow | ✅ lint → typecheck → unit → integration → build |
| ¥100k→¥5k reproduced by tests | ✅ |
| Day-12 stressed shortage reproduced | ✅ (engine test + live demo API + E2E) |
| Production build | ✅ `next build` 16 routes + engine tsc |
