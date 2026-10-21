# Core CRM audit — Dashboard, Leads, Clients, Bookings (2026-10-21)

Method: code read of every page, component and server action under the four menus, then the important
claims checked against production Supabase (`dfjyslxrzniqtlniseat`). Permission tests ran as a simulated
user inside a block that raised at the end, so nothing was written. The browser walk-through was skipped
because the preview pane isn't signed in and the project has no test login.

Baseline: `tsc` clean, `npm test` 380/380 passing.

Severity: **P1** = a feature is broken or can be bypassed · **P2** = wrong result or data at risk · **P3** = polish.

## What works

- Dashboard stats come from `get_lead_stats` and `get_booking_stats`, which run as the caller, so RLS scopes them. The **26** on the Leads badge is correct: 26 of the 33 active leads have a follow-up date in the past (see L7 for why it's so high).
- Lead list: views, filters, sort, search, pagination and the Table/Kanban toggle all keep their state. Search handles commas and formatted phone numbers.
- Booking approval guards hold in the DB: an advisor can't confirm a booking or change payments (bookings and payments guard triggers).
- Lead → client conversion, one client per lead, and approve → plot booked → lead closed won → first installment all chain correctly. The 3 bookings in prod are consistent: plot booked, lead closed won, same project.
- PAN and Aadhaar are encrypted at rest. All 3 clients are encrypted (no plaintext left).

## Leads

| # | Sev | Issue | Where |
|---|-----|-------|-------|
| L1 | P1 | **The "Move to …" buttons skip the next stage.** The list drops the current stage, but the slice still uses indexes from the full stage list. So *New* offers Interested / Site Visit Scheduled (no Contacted), *Contacted* offers Site Visit Scheduled / Done (no Interested), and *Negotiation* only offers "Future Follow-up" (no Token Paid). | `components/leads/LeadDetailActions.tsx:35` |
| L2 | P1 | **Merging a duplicate loses its timeline.** `lead_activities` has no UPDATE policy, so re-parenting moves 0 rows. Verified as admin: 5 activities visible, 0 moved. They stay on the retired, hidden lead. All 8 re-parent updates also ignore errors. | `lib/leads/actions.ts:600` |
| L3 | P1 | **The duplicate warning on Add Lead almost never fires.** 31 of 33 leads are stored as `+91-XXXXXXXXXX`, but `checkDuplicate` does an exact match on the typed digits. The phone ingest path already matches on the last 10 digits. Also, under RLS an advisor or telecaller only sees their own leads, so they're never warned about a lead someone else owns. | `components/leads/LeadForm.tsx:60`, `lib/leads/queries.ts:240` |
| L4 | P1 | **Advisors can bypass lead rules through the API.** `leads` has no column guard, and its UPDATE policy has no WITH CHECK. Verified as a sales advisor: set own lead to `closed_won` (no booking), set score to 100, soft-deleted it (the app allows this for admins only), and inserted a timeline entry on *another person's* lead with `performed_by` = admin. This is the same gap that was closed for bookings and payments. | DB: `leads`, `lead_activities` policies |
| L5 | P2 | The Kanban card stage menu offers **Closed Won** (skips the booking, which bulk-change blocks) and **Not Interested** (skips the loss reason). Leads moved there then vanish because the board has no columns for them. | `components/leads/LeadsKanban.tsx:143` |
| L6 | P2 | The pipeline bar on a *Not Interested* or *Future Follow-up* lead shows every stage up to and including **Closed Won** as done (green). | `app/(dashboard)/leads/[id]/page.tsx:111` |
| L7 | P2 | **Overdue only grows.** Logging a call or note without ticking "schedule follow-up" keeps the old past date. Only *not reachable* and *callback* reset it. So a lead someone just spoke to stays overdue, which is why 26 of 33 are overdue. | `lib/leads/actions.ts:263` |
| L8 | P2 | Errors are silent on the stage buttons, the Not Interested modal, Reassign and Follow-up. The result is ignored and the modal closes as if it worked. | `LeadDetailActions.tsx:41`, `LossReasonModal.tsx:35`, `AssignModal.tsx:25`, `FollowUpModal.tsx:30` |
| L9 | P3 | The advisor filter and the Reassign list only include `sales_advisor` and `manager`. In prod, 31 of 33 leads are assigned to the **admin**, so they can't be filtered by owner, and nobody can reassign a lead back to the admin. Telecallers are excluded too. | `getActiveAdvisors` in `lib/leads/queries.ts:267` |

## Clients

| # | Sev | Issue | Where |
|---|-----|-------|-------|
| C1 | P2 | **Client search breaks** on a comma ("Sharma, Rahul": PostgREST error, so an empty list) and on formatted phones ("+91 98…"). It builds the `.or()` string by hand instead of using `searchOr` like Leads. | `lib/clients/queries.ts:29` |
| C2 | P3 | The booking count on client cards includes cancelled bookings. | `app/(dashboard)/clients/page.tsx:36` |
| C3 | P3 | "Next due amount" shows the full installment even when part of it is paid. | `lib/clients/queries.ts:121` |
| C4 | P3 | `?page=abc` gives `NaN` offsets and an empty list. Bookings has the same problem. | `clients/page.tsx:22`, `bookings/page.tsx:22` |

## Bookings

| # | Sev | Issue | Where |
|---|-----|-------|-------|
| B1 | P2 | **Cancelling a confirmed booking leaves the lead on Closed Won**, so the win rate and source ROI still count a sale that didn't happen. | `lib/bookings/actions.ts:244` |
| B2 | P2 | **An advisor can release the hold their own pending booking placed.** `plots_guard` lets the hold owner set the plot back to `available`. The plot then looks free while the booking waits, another advisor can hold it, and approval overwrites their hold. | DB `plots_guard` + `createBooking` |
| B3 | P2 | **Deleting an installment with a part-payment is allowed.** Only `paid` is blocked, so money already received disappears from the totals. Installment numbers are `count+1`, so they collide after a delete (there's no unique constraint). | `lib/bookings/actions.ts:322` |
| B4 | P2 | `createBooking` trusts the browser's `project_id` (it isn't checked against the plot's project) and sale value. An empty amount gives `NaN` and a raw DB error. | `lib/bookings/actions.ts:28` |
| B5 | P3 | The status tabs drop the search term, and searching drops the status. | `app/(dashboard)/bookings/page.tsx:50` |

## Dashboard

No functional bugs. It inherits L7: the "Overdue Follow-ups" tile and the sidebar badge both show 26.

## Data notes (not code)

- There are two active telecaller accounts both named **"VALI MOHD."** in different teams. Check whether one is a leftover.
- 31 of 33 active leads sit with the admin account.

## Fix plan (2026-10-21)

**Database** — migration `20261025100000_core_crm_guards.sql`, applied to production, checked by `tests/sql/06_core_crm_guards.sql`:
1. `leads_guard` trigger (L4): non-managers can't move a lead into or out of Closed Won, change `is_active`, or change `created_by`, `is_duplicate` or `duplicate_of`.
2. `lead_activities` insert policy (L4): `performed_by` must be the caller, and the lead must be visible to the caller.
3. `plots_guard` (B2): a hold can't be released while the plot has a booking pending approval.

**App**
- L1: the stage buttons offer the next two forward stages; a Not Interested or Future Follow-up lead gets Reopen buttons.
- L2: merge checks that the caller can see both leads, then moves the child records with the service role and checks each result. It refuses when both leads already have a client.
- L3: `checkDuplicate` matches on the last 10 digits, and across all leads (service role, minimal fields) so advisors get warned too.
- L5: `changeLeadStage` refuses Closed Won and requires a loss reason for Not Interested. Kanban opens the loss-reason modal and drops Closed Won from its menu.
- L6: the pipeline bar marks no stages done for a lost or parked lead.
- L7: logging a contact (call, WhatsApp, email, SMS, meeting) clears a follow-up that is already past due.
- L8: stage, loss-reason, reassign and follow-up actions show an error toast instead of closing silently.
- L9: owner lists include admins and telecallers.
- C1 `searchOr`; C2 count only non-cancelled bookings; C3 next-due subtracts part-payments; C4 page parsing.
- B1: cancel moves a won lead to Not Interested ("Booking cancelled") when the client has no other confirmed booking.
- B3: an installment with money received can't be deleted, and the next number is max+1.
- B4: the booking takes its project from the plot and validates the amounts.
- B5: status tabs and search keep each other.

## Resolution status (2026-10-21)

Every item above is fixed. The migration is applied to production, and `tests/sql/06_core_crm_guards.sql` passes on production (10/10, rolled back).

Checks: `tsc` clean · `npm test` 393/393 (13 new in `tests/actions/core-crm-audit.test.ts`) · `npm run test:db` 321 selects / 251 writes.
Not checked in a browser: the preview pane has no CRM login.

Notes:
- The 26 overdue leads already in the database stay overdue until someone logs a contact on them or reschedules them. The fix stops new ones piling up; it doesn't backdate.
- An advisor can still change a lead's `score` directly, because scoring runs in the user session. It's low impact, so it's left as is.
- `checkDuplicate` now reads across all leads with the service role. It returns only name, stage, owner and date, and links only to leads the user can open.
