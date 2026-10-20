# Demo Script — XiaoCai AI (Ms. Li)

Aim: 4–5 minutes. The point is not “look at a dashboard”; it is **“every number
is traceable, and the owner decides — XiaoCai executes nothing.”**

## Setup (before the audience arrives)

```bash
# terminal 1 — API
cd apps/api && npm run dev          # http://localhost:4000

# terminal 2 — web
npm run dev:web                     # http://localhost:3000

# one-time — database + demo data
npm run db:deploy && npm run db:seed
```

> **Seed freshness:** the demo dataset places supplier invoices relative to the
> day it is seeded (the big ¥48,800 invoice lands ~12 days out, a ¥40,000 one
> ~6 days out, one ¥2,000 invoice overdue). Re-run `npm run db:seed` on the day
> you present so the “shortage lands on the big invoice’s due day” moment is
> seen at the intended offset. The engine does not depend on a magic day number:
> the shortage always lands on the due day of the invoice that breaches cash.

Open http://localhost:3000 and press **Try the Ms. Li demo**.
Account for a normal login: `msli@demo.xiaocai.ai` / `Demo1234!`.
Each demo visit creates an isolated clone, so nothing you do here affects
another visitor.

## 1. Dashboard — “What is actually happening?” (45 s)

- GMV is ~¥180,000 over 30 days, but **real profit** is much lower. Say the
  core line: *“Revenue is vanity; real profit is the number that pays you.”*
- Point at the cash card: no shortage in the **base** forecast.
- Point at the insight cards: they are deterministic templates built from the
  same engine result, not generated prose.
- Note the freshness line (last order, last import, computed-at) — never a
  silent zero.

## 2. True Profit + evidence — “Can I trust it?” (60 s)

- Open **Profit**. Walk the cost ladder: product cost, ads, influencer
  commission, delivery, refunds, platform fees.
- Click a headline figure → **evidence drawer**. Show the underlying orders
  (channel, external ID, amount, date). Say: *“This is the answer to ‘where did
  this number come from?’ — no AI involved.”*
- Open **Drivers**. Explain that contributions **reconcile exactly** to the
  profit change; percentages are blank when the prior period is zero instead of
  inventing “+∞%”.

## 3. Survival Simulator — the shortage moment (60 s)

- Open **Simulator**. Base curve: minimum balance stays positive; the seeded
  obligations (¥40,000 ~day 6 and ¥48,800 + ¥1,200 ~day 12) are marked.
- Apply the stress: **sales −20%, supplier cost +10%, payout delay +5 days**.
- The curve crosses zero on the due day of the ¥48,800 invoice — the engine’s
  `firstShortageDay` lands exactly on that obligation. Say: *“You still have time
  to act — but only if you see it now.”*
- Move the sliders; every recompute is server-side engine math, not a browser
  estimate.
- Save the scenario; show it under saved scenarios.

## 4. Financing — “What can I do?” (45 s)

- Open **Financing**. Four qualitative options are ranked: extend supplier
  terms, settlement advance, merchant working capital, bank SME loan.
- Emphasise the disclaimer: no rates, limits or approval chances are invented
  because no verified lender feed is connected. This is a research checklist.
- Say: *“XiaoCai never applies for credit and never messages a lender.”*

## 5. Daily Brief + Approvals — “What do I do today?” (45 s)

- Open **Brief**. Show urgent payments, overdue invoices, rising costs, missing
  documents, and the cash risk line.
- Copy/print the brief (owner can send it to their accountant).
- Open **Approvals**. Pick the day-12 item. Show **Evidence · Impact · Action**.
- Press **Approve**. The response returns `executesNothing: true` and a list of
  next steps for the owner. Say: *“Approval records a decision. It does not pay,
  message or move money.”*

## 6. Sources + Audit — “Who can see what?” (45 s)

- Open **Sources**. Revoke a channel source. Return to **Profit** — revenue
  drops, because revoked data is excluded at the single authorised-read
  boundary. Re-grant it.
- Open **Audit**. Filter by action, then **Export CSV** (formula-injection safe).
- Press **Verify integrity**: the hash chain is valid. Explain: every log row is
  chained with SHA-256; tampering is detectable.

## 7. Security + LLM-off (30 s)

- Open **Security**: current role, sources granted/revoked, recent auth events.
- Say: *“Roles are enforced server-side. A VIEWER cannot import or see the audit
  trail; only the OWNER can approve.”*
- Optional: open the assistant. With no `ANTHROPIC_API_KEY`, it returns a
  templated answer — and *the whole product still works*. That is the design:
  **Data in. Math decides. AI explains.**

## Closing line

> “XiaoCai does not guess your profit and it does not spend your money.
> It shows what is really left, when cash runs short, and what you could do —
> and then it waits for you to decide.”

## Recovery notes

- **Demo unavailable (503):** the canonical dataset is not seeded. Run
  `npm run db:seed`.
- **No cash shortage in the base:** expected. Shortage appears only in the
  stressed scenario, on the day the ¥48,800 invoice is due.
- **Assistant says `LLM_UNAVAILABLE`:** expected without an API key; the demo
  does not depend on it.
- **Slow first demo request:** the clone copies ~600 orders; subsequent visits
  are cached by the database.
