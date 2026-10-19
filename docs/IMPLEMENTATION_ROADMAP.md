# Implementation Roadmap — production build-out

Dependency-ordered. Each step ends with lint + typecheck + tests green and a commit.

1. **Engine** (`packages/engine`): types (fen), trueProfit + groupings, profitDrivers (reconciling), cashForecast + applyScenario (demo constants → stressed Day-12), financingMatcher (qualitative), buildEvidenceTree, dailyBriefData. 45+ Vitest tests incl. ¥100k→¥5k and Day-12.
2. **Schema additions**: `Session` (server-side revocation via jti), `AuditLog.prevHash/hash` (tamper-evident chain). Offline `migrate diff` → `1_sessions_audit_chain`, applied via `db-migrate-443.ts`.
3. **Seed**: deterministic Ms. Li dataset (600 orders / 60d / 3 channels, GMV ≈ ¥180k, settled ≈ ¥142k, supplier ≈ ¥90k incl. 1 MISSING_DOC, D15–D28-ish settlements, isDemo=true) + repeatable runner.
4. **Data access**: `getAuthorisedData(businessId, range)` — the only raw-table path for engines; revoked sources excluded.
5. **API**: profit (summary/by-product/by-campaign/by-channel/drivers), cash (forecast/scenario/alerts), financing/options, evidence/:metric, brief/daily, recommendations + approvals (OWNER-only decision), audit (+CSV export w/ formula-injection sanitization), imports (preview/confirm/templates/history, multer+papaparse, row errors, ImportJob), sources (list/grant/revoke), assistant/ask. Zod everywhere, roles enforced, DATA_ACCESS audited, business isolation on every query.
6. **AI layer**: provider abstraction (Claude via fetch / Noop), parseWhatIf (Zod, clamps, EN+中文), explain() with numbers-must-come-from-engine post-check, EN/中文 templates, injection guards. App fully functional with LLM off.
7. **Security hardening**: CSRF double-submit on mutations, session revocation wired into logout + requireAuth, account lockout, stronger password policy, audit hash chain, CSV sanitization, docs (SECURITY_SELF_ASSESSMENT, DATA_FLOW, RISK_REGISTER, PRIVACY_NOTES, FINANCIAL_METHODOLOGY).
8. **Frontend**: React Query provider; 10 real pages; EvidenceNumber + evidence drawer; waterfall/bar/line charts (Recharts); import wizard (upload→map→preview→confirm); approvals UI; audit filters+export; brief with copy/print; mobile drawer; complete EN/中文 messages.
9. **Testing**: engine tests; supertest integration suite on embedded PG (auth, roles, isolation, imports, approvals, audit, revoked-source exclusion); Playwright workflows A/B (attempt — browser download required).
10. **DevOps/docs**: GitHub Actions CI, README overhaul, DEMO_SCRIPT, final feature matrix refresh + implementation report.
