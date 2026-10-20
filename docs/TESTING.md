# Testing the CRM

Four layers, all runnable without credentials except the SQL suites.

| Layer | Command | What it proves | Needs |
|-------|---------|----------------|-------|
| Unit + action + route tests (Vitest) | `npm test` | Business logic, server actions, webhooks, crons — **265 tests** | nothing (in-memory database) |
| HTTP smoke test | `npm run test:smoke -- https://your-crm-url` | The deployed app: pages bounce to login, every webhook/cron/API refuses unauthenticated calls — **69 checks** | a running URL |
| SQL: security | `tests/sql/01_security_rls.sql` | RLS and privileges for outsiders, telecallers, anon; internal functions not callable — **38 checks** | Supabase SQL editor / `psql` |
| DB sweeps | `npm run test:db` | Every `.select()` in the code is accepted by the real database, and every insert/update payload uses real columns (catches the silent-failure bugs that blank whole screens) — **270 + 231 checks** | `.env.local` with the service key |
| SQL: integrity | `tests/sql/02_integrity_and_functions.sql` | Constraints, triggers, the hold-release job and function, portal OTP, new-user roles, dashboard functions, data consistency — **40 checks** | Supabase SQL editor / `psql` |

The SQL scripts run inside a transaction that is rolled back, so they never change data. They print only the failing checks plus a `TOTAL checks` row. Checks named `DATA:` flag real data problems (not code bugs).

## What the Vitest suite covers (`tests/`)

- `unit/` — lead scoring, currency/phone/date formatting, SLA, WhatsApp phone/template/variable/button helpers, shared-secret and HMAC checks, Razorpay signature, SMS and Exotel number formats, email escaping, PAN/Aadhaar encryption.
- `actions/leads` — intake (normalise, de-duplicate, assign, score, notify), assignment rules, manual create/edit, stage changes, follow-up logging, bulk assign/stage, delete, merge, site visits.
- `actions/bookings-payments` — plot holds, booking create/approve/reject/cancel, installments, payments (full, part, accumulating, waive), complaints, documents.
- `actions/automation-engine` — trigger matching, every condition operator, every action type, delays, once-per-day de-duplication, failure isolation.
- `actions/brokers-portal-loans-legal` — broker portal login, commissions, lead registration, loans, DPDP erasure, extension review.
- `actions/broadcast-and-send` — broadcast audience, opt-outs, idempotent sending, rate limits, receipts, replies.
- `actions/portal-construction-notify` — client-portal OTP login, portal requests, notifications and push, construction milestones.
- `actions/hr-team` — leave, payroll arithmetic, team admin.
- `actions/clients` — government-ID encryption on save.
- `actions/rbac-matrix` — **every manager/admin-only action refused to lower roles**, and to anonymous callers.
- `routes/` — lead/AgencyX/Razorpay/Exotel webhooks (signatures, idempotency), all four cron routes, login lockout, mobile API.

`tests/helpers/fakeSupabase.ts` is a small in-memory stand-in for the Supabase client (select/insert/update/upsert/delete, filters, ordering, counts, embedded rows via dotted paths, auth admin, unique-constraint hooks). It does **not** enforce RLS or SQL semantics — that is what the SQL suites are for.

## Not covered (needs a browser and credentials)
Clicking through the UI, PDF layout, real WhatsApp/Razorpay/Exotel/Resend delivery, and Vercel cron scheduling. Run the smoke test after every deploy.
