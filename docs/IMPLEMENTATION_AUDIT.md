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

---

# Post-build verification (2026-10-20)

The build-out above was completed; this section records the verification pass and
the defects fixed during it.

## Defects found and fixed

| # | Defect | Fix |
|---|---|---|
| 1 | API typecheck broke: `moneyColumn` returned `ZodType<number>` incompatible with the `unknown`-input object schema | widened the return type to `ZodType<number, ZodTypeDef, unknown>` (`services/csv.ts`) |
| 2 | `<ToastProvider>` never mounted → every page using `useToast` crashed at runtime (`useToast must be used inside <ToastProvider>`) | wrapped children in `Providers` (`components/providers.tsx`) |
| 3 | Landing page had no “Try the Ms. Li demo” action — E2E A blocked | added `DemoStartButton` (calls `/api/auth/demo`, no credential in client) |
| 4 | Dashboard was a placeholder with em-dashes, no demo banner, no real data | rewrote as a real client page over `/api/dashboard/summary` (KPIs, insights, alerts, freshness, empty states, DemoBanner) |
| 5 | i18n: `audit`/`sources` pages looked up the wrong namespace (`audit.common.all`, `sources.sources.kindOrders`) → MISSING_MESSAGE | corrected keys |
| 6 | `?next=` set by the route guard was ignored; login/register always went to `/dashboard`; no open-redirect protection | added `safe-redirect.ts` + wired both pages |
| 7 | Register lacked password confirmation + live strength feedback (spec §5) | added confirmation field, `PasswordStrength`, and server-side `.refine` mismatch check |
| 8 | E2E slider helper set `input.value` directly → React ignored it, scenario never applied | use the prototype value setter then dispatch `input`/`change` |
| 9 | A/ B E2E locators were brittle (strict-mode violations, hidden `<option>`) | scoped assertions to roles/dialogs/cells; B fills the new confirm field |
| 10 | No test for the AI numerical guard (spec §9) | added `apps/api/tests/ai-guard.test.ts` (12 tests) proving fabricated values are discarded |
| 11 | Stressed-shortage day appeared as day 11 across a UTC day boundary while docs said 12 | corrected the E2E to derive the day from the due invoice (the true invariant) and documented the calendar-day behaviour |

## Final verification evidence

| Gate | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ 0 errors/warnings (3 workspaces) |
| Typecheck | `npm run typecheck` | ✅ 3 workspaces clean |
| Unit tests | `npm test` | ✅ API 23 + engine 73 |
| Integration | `npm run test:integration` | ✅ 26 (embedded PG) |
| E2E | `npx playwright test` | ✅ Workflow A + B |
| Build | `npm run build` | ✅ 16 web routes + engine tsc |

