# Privacy Notes — XiaoCai AI

Status: prototype / hackathon build. This note describes what data the system
stores, why, where it goes, and what a production deployment would still need.
It is **not** a legal privacy policy.

## 1. Data we store

| Category | Fields | Purpose |
|---|---|---|
| Account | email, name, role | authentication, authorization, display |
| Credential | bcrypt password hash | authentication (the plaintext is never stored) |
| Business | business name (EN/ZH), currency, opening cash | tenant identity, forecast origin |
| Financial records | orders, settlements, ad spend, supplier invoices, products | the only source of financial numbers |
| Operational | import jobs, scenarios, recommendations, approvals | user actions and their outcomes |
| Security | sessions (`jti`, IP, timestamps), audit log | revocation, accountability |
| Demo | cloned business + random-password demo user | isolated demo experience |

Money is stored as integer fen; no card numbers, bank credentials, ID numbers or
home addresses are collected.

## 2. Where data lives

- **Postgres** (Neon in the hosted prototype; embedded Postgres for local dev).
- The database is the only durable store. There is no analytics warehouse, no
  third-party CRM and no advertising SDK.
- Uploaded CSV files are processed **in memory** and are not written to disk.

## 3. Third parties

| Recipient | Data | When |
|---|---|---|
| Managed Postgres provider (Neon) | all database contents | always |
| Anthropic (Claude) | **only** the user's assistant question text + the engine result needed to phrase an answer | only if `ANTHROPIC_API_KEY` is set and the user calls `/api/assistant/ask` |

No financial records, emails, names or CSVs are sent to the LLM. The assistant
sends a question and a small engine summary (numbers the API already computed).
If no key is configured, nothing leaves the deployment.

## 4. Retention

| Data | Retention |
|---|---|
| Demo clones | deleted on the next demo request after 24 hours (cascade) |
| Sessions | 7-day TTL; revoked immediately on logout |
| Audit log | retained for the life of the business in this prototype; no delete path |
| Imported records | retained until the business is deleted |
| Server logs | request logs only; cookies/authorization/passwords/emails redacted |

There is no automated deletion endpoint in the prototype. A production build
needs account closure, export and deletion workflows.

## 5. Access control

- Users see only their own business's data (`businessId` on every query).
- Roles limit what can be read or changed (VIEWER cannot see audit or import;
  only OWNER can approve or grant/revoke sources).
- Audit history is append-only and tamper-evident.

## 6. Known gaps before production

1. No email verification or password reset flow.
2. No MFA.
3. No consent capture or privacy-policy acceptance flow.
4. No data-subject export/delete tooling.
5. No field-level encryption beyond transport (TLS) and password hashing.
6. No regional data-residency configuration.
7. Rate-limit/lockout state is in memory (see R5), so it is lost on restart.

These are tracked in `RISK_REGISTER.md`.
