# Implementation Audit — XiaoCai AI (2026-10-19, Phase Zero)

Scope: full inspection of repository state at commit `6f5e41d` before the production-quality build-out.

## Repository state

- Monorepo, npm workspaces: `apps/web`, `apps/api`, `packages/engine`. Clean git tree, 7 commits, no secrets in history (verified programmatically at Phase 1).
- Node v24, npm 11. Strict TS base config (`noUncheckedIndexedAccess` on). ESLint `no-explicit-any: error` in api/engine; web via `next/core-web-vitals`.
- Baseline checks at audit time: lint ✓ (3 workspaces), typecheck ✓, Vitest 7/7 ✓ (JWT + password utils), `next build` ✓ (5 routes), API live on :4000 with `db:true` via Neon-over-443.

## What exists and works (verified evidence)

| Area | State | Evidence |
|---|---|---|
| Auth (register/login/logout/me) | ✅ verified | E2E on real Neon + embedded PG: 201/200/204/401/409/400/429; audit rows REGISTER/LOGIN/LOGIN_FAILED/LOGOUT confirmed in DB |
| Session security | 🟡 partial | httpOnly JWT cookie ✓, per-request user re-fetch ✓; no server-side revocation, no CSRF token yet |
| Roles | 🟡 partial | OWNER/ACCOUNTANT/VIEWER enum + `requireRole` middleware exist; zero endpoints enforce roles yet |
| Prisma schema | ✅ complete for domain | 13 models, money in fen, 3 spec'd compound indexes, migration `0_init` applied on Neon |
| Audit log | 🟡 partial | append-only via code (no update/delete path), no hash chain yet |
| Health | ✅ verified | SELECT 1, 200/503 distinction |
| Web shell | ✅ verified | Landing, login, register, dashboard stub, sidebar (9 stubs), EN/中文, route guard middleware |
| Engine | ❌ missing | `packages/engine` contains only a version constant |
| Seed / demo data | ❌ missing | no seed script; user created one manual account (demo@xiaocai.ai) |
| Imports | ❌ missing | ImportJob model exists; no endpoints |
| Financial API | ❌ missing | no profit/cash/financing/evidence/brief/approval/audit routes |
| AI layer | ❌ missing | by design (Phase 5) |
| Financial screens | ❌ missing | dashboard shows placeholders honestly labeled "Lands in Phase 6" |

## Architecture inconsistencies found

1. None blocking. One deviation vs. original spec, justified and documented: DB connectivity uses Neon WebSocket driver over 443 for `*.neon.tech` hosts (ISP drops 5432 payloads — diagnosed with protocol probe, commit `3df71a1`).
2. `AuditLog.businessId` is required, so LOGIN_FAILED for unknown emails cannot be audited (documented behavior, not a bug).
3. Web tsconfig does not extend the root base config (Next.js manages its own); strictness is equivalent.

## Decision

Proceed in dependency order: engine → seed/imports → API → AI → frontend → hardening → tests/CI/docs. No architecture changes required.
