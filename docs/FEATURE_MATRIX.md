# Feature Matrix — XiaoCai AI

Status legend: ✅ verified complete · 🟢 implemented, verification pending · 🟡 partial · ❌ missing

Updated: 2026-10-19 (Phase Zero baseline — refresh at each phase completion)

## Backend / data

| Feature | Status | Notes |
|---|---|---|
| Register (Business + OWNER atomic) | ✅ | transaction, 409/400 paths tested |
| Login / logout / me | ✅ | E2E on Neon + embedded PG |
| JWT httpOnly session cookie | ✅ | HS256, 7d |
| Login rate limit (10 fails/15min) | ✅ | 429 verified |
| Server-side session revocation | ❌ → planned Phase 7 step |
| CSRF double-submit | ❌ → planned |
| Roles OWNER/ACCOUNTANT/VIEWER enforced per-endpoint | 🟡 | middleware exists, no endpoint uses it yet |
| 13-model schema, money in fen, indexes | ✅ | migration 0_init on Neon |
| Audit log (append-only, login events) | 🟡 | DATA_ACCESS + hash chain pending |
| /health with DB check | ✅ | 200/503 |
| Neon-over-443 driver (auto) | ✅ | verified live |
| Engine `@xiaocai/engine` | ❌ | Phase 2 |
| `getAuthorisedData(businessId)` | ❌ | Phase 3 |
| Seed (Ms. Li, GMV ¥180k, 600 orders) | ❌ | Phase 3 |
| CSV import (orders/settlements/ads/invoices) | ❌ | Phase 3 |
| Sources grant/revoke API | ❌ | Phase 3 |
| Profit/cash/financing/evidence/brief APIs | ❌ | Phase 4 |
| Recommendations + approvals API | ❌ | Phase 4 |
| Audit API + CSV export | ❌ | Phase 4 |
| AI parseWhatIf / explain with number guard | ❌ | Phase 5 |

## Frontend

| Feature | Status | Notes |
|---|---|---|
| Landing / login / register | ✅ | |
| Dashboard (shell + API chip) | 🟡 | KPI placeholders honest; real data pending Phase 6 |
| Sidebar 10 destinations | 🟡 | 1 real, 9 stubs |
| EN/中文 i18n | ✅ | cookie locale, all existing strings translated |
| Route guard middleware | ✅ | |
| True Profit / Drivers / Simulator / Financing / Brief / Approvals / Sources / Audit / Security screens | ❌ | Phase 6 |
| EvidenceNumber drill-down | ❌ | Phase 6 |
| Mobile drawer ≤360px | ❌ | Phase 6 |

## Quality

| Item | Status |
|---|---|
| Engine unit tests (≥40) | ❌ → Phase 2 |
| API integration tests | 🟡 | 7 auth-utils unit tests only |
| Playwright e2e | ❌ |
| CI workflow | ❌ |
| ¥100k→¥5k reproduced by tests | ❌ → Phase 2 |
| Day-12 stressed shortage reproduced | ❌ → Phase 2 |
