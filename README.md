# XiaoCai AI 小财 AI — The Business Profit & Survival Agent

> **See what's really left — before it's too late.**
> SME Finance Copilot for multi-channel sellers in China (Douyin, Taobao/Tmall, Xiaohongshu, Pinduoduo).
> Shenzhen FinTechathon 2026 · International Track · Topic E.

**Status:** Phase 1 of 8 — scaffold, database schema, auth. ✅

## The core rule (non-negotiable)

**"Data in. Math decides. AI explains."**

Authorised data → deterministic engine (the only source of numbers) → AI layer that parses
questions and writes explanations → the owner approves every financial action.
The AI **never** creates a number. The app works fully with the LLM turned off.

## Structure

```
apps/
  web/          Next.js App Router · TS · Tailwind · shadcn-style UI · next-intl (EN/中文)
  api/          Express · TS · Zod · Prisma · JWT (httpOnly cookie) · audit log
packages/
  engine/       Pure TS — no I/O, no LLM. Money = integer fen (¥1 = 100).
```

## Quickstart

Prereqs: Node 20+, a PostgreSQL URL (Neon).

```bash
# 1. install
npm install

# 2. configure the API env — paste YOUR rotated Neon URL into apps/api/.env
cp apps/api/.env.example apps/api/.env

# 3. create the schema (first time)
npm run db:migrate
#    └─ on a network that blocks port 5432 (some ISPs/venue WiFi), migrate
#       over HTTPS 443 instead:  npx tsx apps/api/scripts/db-migrate-443.ts
#       (the API itself always uses 443 for *.neon.tech hosts — automatic)
#    └─ no Neon access at all? run a local throwaway DB instead:
#       npx tsx apps/api/scripts/embedded-pg.ts  (then point DATABASE_URL at
#       postgres://postgres:postgres@localhost:5433/xiaocai)

# 4. run the API        → http://localhost:4000/health
npm run dev:api

# 5. run the web app    → http://localhost:3000
npm run dev:web
```

Verify: `curl http://localhost:4000/health` → `{"status":"ok","db":true,...}`,
then register at http://localhost:3000/register and you land on the dashboard.

## Environment variables

| Var | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `apps/api/.env` | Neon Postgres connection (`sslmode=require`; drop `&channel_binding=require` if Prisma complains) |
| `JWT_SECRET` | `apps/api/.env` | ≥32 random chars — `openssl rand -hex 32` |
| `WEB_ORIGIN` | `apps/api/.env` | Allowed CORS origin (comma-separated) |
| `PORT` | `apps/api/.env` | API port (default 4000) |
| `NEXT_PUBLIC_API_URL` | `apps/web` build env | API base URL (defaults to `http://localhost:4000`) |

**Security:** `.env` is gitignored and must never be committed or pasted into chats.
Only `.env.example` (fake values) lives in git.

## Conventions

- Money is stored as **integer fen** in the DB; formatted only at display time.
- `packages/engine` is pure functions with unit tests — no DB, no LLM, no clock.
- Zod validates every API input. Strict TypeScript, no `any`.
- Every login/logout/register (and later every data access, approval, grant/revoke)
  writes an insert-only `AuditLog` row.
- Phases are built one at a time; lint + typecheck + tests must pass after each.
