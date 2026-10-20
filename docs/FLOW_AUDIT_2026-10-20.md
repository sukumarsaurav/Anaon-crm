# End-to-end flow audit — lead → visit → booking → payment → portal

**Date:** 2026-10-20 · **Production:** `anon-crm.vercel.app` · **Method:** traced each flow through the code and checked it against the live Supabase schema and data; fixes applied and verified with `tsc`, `next build` and SQL simulation. Not done: clicking through the production UI (login needs real credentials).

Companion to `FUNCTIONAL_AUDIT_2026-10-20.md` (feature audit) and `FIX_PLAN_2026-10-20.md`.

## Flow map and verdict

| Flow | Verdict before | Verdict now |
|------|----------------|-------------|
| Lead intake (ads, WhatsApp, portals, website, broker, manual) | Works, but assignee never notified for ingested/manual leads; project lost from automation context | Fixed |
| Assignment / reassignment | Single path fine; **bulk assign** skipped timeline, notification and automation | Fixed |
| Follow-up & activity logging | Broken (`increment`) — fixed earlier | Fixed |
| Stage changes | Single path fine; **bulk stage** skipped score, automations, from/to, loss-reason clearing, validation | Fixed |
| Site visits | Day-of cron re-fired the *scheduled* trigger (duplicates; "remind 23h later" landed the day after the visit) | Fixed (own trigger) |
| Lead merge | Left WhatsApp threads and broker registrations pointing at the retired lead | Fixed |
| Plot hold → booking | Pending booking kept an expiring hold (would be freed by the new scheduler → double booking); two advisors could claim one plot; no DB guard | Fixed + DB unique index |
| Booking approve / reject / cancel | Reject worked on confirmed/cancelled bookings and freed plots another booking owned; cancel left installments pending (reminders kept going), voided already-paid commissions; approve ignored plot-update failure | Fixed |
| Payments | A part payment marked the installment **paid**; a second payment overwrote the first; waived installments counted as outstanding; reports counted full `amount_due` | Fixed |
| Scheduled automations | **Birthday and anniversary automations never fired** (`LIKE` on a `date` column errors; error ignored); UTC instead of IST dates; 50/100-row caps; cancelled bookings still chased | Fixed |
| Automation builder | Stage list (`new`, `booked`, `lost`) did not match the DB enum → "change stage" always failed | Fixed |
| Construction milestones | Milestone WhatsApp had no client in context (always "No phone number") and an empty project name | Fixed (fans out to each booked client) |
| Client portal login | **Could never work**: phone match failed for formatted numbers (all 3 clients), and OTP verify failed at token creation (`gen_random_bytes` not on the function's search_path since the security hardening) | Fixed + verified |
| Portal complaints / extension requests | Staff were never notified | Fixed |
| Dashboards & stat cards | **4 database functions were never deployed** (`get_exec_dashboard`, `get_booking_stats`, `get_loan_stats`, `get_advisor_scorecard`) → executive dashboard, booking/loan stat cards and the advisor scorecard silently showed zeros | Deployed (corrected) + verified |

## Fixes applied (this pass)

**Database (live, migrations in `supabase/migrations/`)**
- `20261020110000` unique index: one non-cancelled booking per plot.
- `20261020120000` portal OTP: match on last 10 digits; `extensions.gen_random_bytes`.
- `20261020130000` the four dashboard functions, as `SECURITY INVOKER` with pinned search_path and no anon access. Corrected from `sql/performance_rpcs.sql`: outstanding = due − paid on confirmed bookings, real `total_collected`, visits = completed visits, IST dates.
- `20261020140000` hold release skips plots with a booking awaiting approval and closes the hold log.
- Data: automation "Site Visit Reminder (Lead)" moved to the new `site_visit_reminder` trigger, delay 0 (it previously fired 23 h after scheduling/after the day-of cron).

**Code**
- Leads: `updateLead` whitelists editable fields (it applied whatever object the browser sent, including `assigned_to`, `stage`, `is_active`); ingest and manual create notify the assignee; bulk assign/stage rewritten; merge re-parents WhatsApp threads and broker registrations.
- Bookings: hold ownership, hold-until cleared on booking, checked plot updates with rollback, status guard on reject, cancel waives open installments and only voids unpaid commissions, lead timeline entry on close-won.
- Payments: accumulating part-payments, `paid` only when covered, waived excluded from totals, report balances.
- Automations: new `site_visit_reminder` trigger; birthdays/anniversaries matched in code; IST; cancelled bookings excluded; limits raised; builder stages fixed; stage-change and assign actions write a timeline entry (assign also notifies).
- Inventory: atomic hold claim; a plot with a pending booking can't be released by hand.
- Portal: phone normalisation; notifications to admins/managers.

## Found but not changed (needs a decision or is data)

| # | Finding | Why left |
|---|---------|----------|
| 1 | Every ingested lead is stored with `whatsapp_opt_in = true` | Consent policy decision (fine for people who messaged you; arguable for ad forms) |
| 2 | Lead de-duplication is check-then-insert with no unique index, so two simultaneous webhook retries can create duplicates | Needs a partial unique index on normalised phone; existing duplicates must be cleaned first |
| 3 | An inbound WhatsApp from an existing client, broker or staff number creates a lead | Needs a lookup against clients/brokers/profiles first |
| 4 | Approving a booking creates no payment schedule; construction-linked demand letters are manual (the "Demand Letters Pending" banner is the only prompt) | Financial side effects — confirm the rule before automating |
| 5 | Booking approval is several separate writes, not one transaction | Mitigated (checked, rolled back on plot failure); a database function would make it atomic |
| 6 | Portal "No account found" reveals whether a phone is a client; two clients sharing a number get the first one | Product trade-off |
| 7 | A manager sees only their own team's bookings, clients, payments and dashboard (RLS follows the team hierarchy); a manager with no team sees nothing | By design (team-hierarchy plan); confirm managers have teams |
| 8 | Data: 3 plots stuck `soft_hold` with no expiry, 6 plots `booked` with no confirmed booking (inventory shows 9 booked, only 3 bookings exist) | Looks like seed/test data — review before launch |
| 9 | Not reviewed in depth: mobile API routes, HR/payroll calculations, blog/website CMS, album sharing | Time |
