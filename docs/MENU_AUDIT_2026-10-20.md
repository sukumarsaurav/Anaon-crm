# ANON INDIA CRM — Menu-by-menu audit (2026-10-20)

Every sidebar menu was walked through in code: pages → components → server actions → database
policies. The important claims were checked against the live Supabase project
(`dfjyslxrzniqtlniseat`). Permission tests ran as a simulated user inside transactions that were
rolled back, so no data changed.

**Baseline (all green):** `tsc` clean · `npm test` 313/313 · `npm run test:db` 262/262 selects and
234/234 write payloads. No dead internal links, no TODO stubs. The problems below are ones those
checks can't see: database policies (the test fake has none), filter values, and features with no
screen.

Severity: **P0** = broken or exploitable now · **P1** = a feature doesn't work as the menu implies ·
**P2** = degraded / gap · **P3** = polish.

---

## Top issues (fix first)

| # | Sev | Menu | Issue |
|---|-----|------|-------|
| 1 | P0 | Bookings / Clients | A sales advisor can **approve their own booking** and **mark installments paid** by calling the Supabase API directly. Verified as a simulated advisor: 1 booking confirmed, 2 installments marked paid (rolled back). |
| 2 | P0 | HR / Team | **No screen can edit, deactivate or reactivate another staff member.** HR "Edit employee", HR "Deactivate", and Team "Activate/Deactivate" all report success but change 0 rows. Verified: as an admin, `UPDATE profiles` on another user → 0 rows. A departed employee keeps CRM access. |
| 3 | P1 (latent P0) | Team → Teams | "Add member" (`addJunior`) creates the user with whatever `role` the browser sends. Any non-admin team leader could create an **admin**. Today only admins lead teams, so it can't be exploited yet. |
| 4 | P1 | Clients / Bookings / Leads | There is **no lead → client conversion.** The client form never sends `lead_id`, so clients created in the UI aren't linked to their lead. Approving the booking then can't mark the lead *Closed Won*, and source/campaign ROI can't count it. (The 3 existing clients were seeded with links.) |
| 5 | P1 | Reports → Leads | **Lead Ageing always shows zeros.** Its filter uses stage names that don't exist (`booked`, `lost`), so Postgres rejects the query. Reproduced: `invalid input value for enum lead_stage: "booked"`. |
| 6 | P1 | Reports → Leads | **Lead Funnel is wrong.** It uses stages `new`/`booked`/`lost`, which always show 0, and it never shows *New Lead*, *Token Paid*, *Closed Won* or *Future Follow-up*. |
| 7 | P1 | Team / HR / Mobile | **Mobile-app check-ins never reach attendance.** The mobile app writes to `attendance`, while Team/HR attendance (and payroll) read `attendance_logs`. |
| 8 | P1 | Inventory | **Scheduled price escalations are never applied.** They are saved to `price_escalations`, but no code, cron job or DB function ever applies them. |

---

## Per-menu findings

### Core CRM

**Dashboard**
- P3: The module grid shows Marketing, HR, Legal and Automation to every role, but the sidebar hides them from advisors and telecallers.
- P3: "Pending Approval" links to the unfiltered `/bookings` list.
- OK: the stats come from `get_lead_stats`, which runs as the caller, so it is scoped by RLS and the role parameter can't be spoofed.

**Leads**
- P2: The filter bar only offers view, stage, temperature, search and sort. The query already supports source, advisor, project, city, budget, score and date, but none of these has a control, so a manager can't filter by advisor or source.
- P2: The Table/Kanban toggle links to `/leads?view_mode=…` and **drops every active filter**.
- P2: Bulk "Change stage → Not Interested" skips the loss-reason prompt (the single-lead path asks for it), so the Win/Loss report loses reasons. Bulk "→ Closed Won" bypasses the booking flow.
- P2: Bulk assign / bulk stage ignore the action result. Failures are silent and the user isn't told how many changed.
- P2: Bulk stage re-scores leads one at a time (about 3 round-trips per lead, up to 500 leads). A large selection can hit the server-action timeout.
- P3: "Merge duplicate" doesn't move `property_albums`, `plot_holds_log` or broadcast-recipient rows to the surviving lead.
- P3: `<Link><Button>` nesting (an `<a>` wrapping a `<button>`) in DuplicateAlert and LeadDuplicatesPanel.

**Clients**
- P1: No lead link (see #4).
- P1: There is **no complaints queue.** Complaints (including ones raised in the client portal) appear only on each client's own page, with no list, assignee or SLA view.
- P2: Documents are **pasted URLs only** (no file upload). The same goes for project documents, signed agreements, construction photos and legal templates; Storage is only used for generated PDFs.
- P2: The client page doesn't show the client's loan applications (`getLoanApplicationsByClient` exists but nothing calls it).

**Bookings**
- P0: See #1.
- P2: "Mark allotment letter sent" only records a timestamp. It sends nothing to the client.
- P2: No payment schedule is generated from the chosen plan type. Installments are added by hand.
- P3: The booking page's "pending total" ignores installments with status `overdue`. Nothing sets that status today, so this is latent.

### Property

**Inventory**
- P1: Escalations are never applied (#8).
- P1 (security): Any staff role can update **any column** on `plots` through the API (`plots_update = current_user_is_staff()`), including price and status. Holds should go through an RPC, and the policy should be limited to managers.
- P2: There's no UI for the premium matrix, plot hold history, or "my active holds" (`savePremiumMatrix`, `getPremiumMatrix`, `getPlotHoldsLog` and `getAdvisorActiveHolds` exist but nothing calls them).

**Albums** — OK. Share tokens are 72-bit random values; create, toggle and delete are wired.

**Construction**
- P2: Completing a milestone sends the automation message, but it doesn't make construction-linked installments due or create a demand letter.
- P2: Sales advisors can **delete** milestones (the action allows `sales_advisor`, and RLS allows all staff).
- P3: Photos are pasted URLs.

**Brokers** — OK. Approve, reject, portal access, commission approve → pay (status-guarded) and lead registration via the shared ingest all work.
- P3: One person can both approve and pay a commission (no maker/checker split).

### Engage

**WhatsApp** — Mostly solid. Every template, broadcast and auto-reply action requires a manager, and the auto-reply page warns that its rules don't run under AgencyX.
- P2: Media can't be sent from the inbox (no brochures or images), even though `sendWhatsAppMedia` exists.
- P3: `getConversationStats` is never shown.

**Marketing** — Not re-audited: it is being changed in a parallel session (uncommitted diffs in `lib/marketing/*` and `components/marketing/*`).
- P3: `getCampaignById` exists, but there is no campaign detail page.

### Finance

**Loans**
- P1: The **document checklist and notes can't be edited anywhere.** The page says "Update docs from the edit page or through the stage advancer", but no edit page exists and the stage advancer has no document fields. `updateLoanDocs` and `updateLoanNotes` have no callers. A loan can move to *Docs submitted* with 0 of N documents ticked.
- P3: There are no bank or DSA detail pages (the queries exist).

**Reports**
- P1: Lead Ageing and Lead Funnel are broken (#5, #6).
- P1 (latent): Every report loads raw rows and counts them in code. Supabase returns at most 1,000 rows by default, so reports will **silently undercount** once a table passes 1,000 rows (34 leads today). The SLA report also sends every lead id in one `in(...)` filter, which will exceed the URL length limit. Move the counting into SQL functions, as `get_lead_stats` already does.
- P2: Source Performance counts leads within the date range, but counts visits and bookings for all time, so its conversion rates mix periods. Bookings are attributed only through `clients.lead_id`, which ties back to #4.
- P3: The report pages have no role check. Data is still RLS-scoped, but every role can open the financial pages.

### Operations

**Team**
- P0: Activating/deactivating a member silently fails (#2).
- P1: The add-member role isn't checked (#3).
- P2: There is no way to change a member's role, branch or team. `updateMemberProfile` has no caller, and it would also fail under RLS. Changing a role currently needs SQL.
- P2: Managers can't correct or mark attendance (`markAttendance` has no caller). There's no UI to move a team under another one (`reparentTeam` has no caller).

**HR**
- P0: Edit and Deactivate employee silently fail (#2).
- P2: Employee **Aadhaar/PAN and bank details are stored in plain text** on `profiles`, while client IDs are AES-encrypted.
- P2: **Leave entitlements can't be set** (`setLeaveBalance` has no caller, and `hr_leave_balances` is empty). Approving a leave inserts `entitled 0, used N`, so balances go negative.
- P2: Individual payroll slips can't be adjusted (`updatePayrollSlip` has no caller).
- P3: The `hr` role in the allow-list doesn't exist in `user_role`, so it's harmless. The page itself has no role check (data is RLS-scoped).

**Automation** — OK. All 16 triggers in the builder are actually fired somewhere, delayed runs are queued and executed by the cron, and the write policies require a manager.
- P3: The pending-executions queue is never shown (`getPendingExecutions` has no caller).

**Legal**
- P1: **DPDP consent is never recorded.** `logConsent` has no caller — not the website form, CRM lead creation, or WhatsApp opt-in — so the consent dashboard on `/legal/privacy` is always empty.
- P2: Legal templates can be created and toggled but **not edited** (`updateLegalTemplate` has no caller).

### Platform

**Mobile** — The admin view reads `attendance`, `site_visits` and `leads`. OK, apart from the split attendance tables (#7).

**Security**
- P2: There is **no "Unlock account" button.** Locked accounts are listed with no action. Users wait out the lockout, or an admin uses SQL.
- P2: The **session-timeout setting is saved but never enforced** (nothing reads `session_timeout_minutes`).
- P2: Turning on the IP allowlist doesn't check that the admin's own IP is on it, so an admin can lock everyone out. The allowlist only covers page routes; the Supabase API and `/api/mobile` are not covered.
- P2: Writes to the allowlist and settings ignore errors. An invalid IP fails silently.
- 2FA was removed on purpose (commit `c0d46f0`, Oct 18). Decided 2026-10-21: it stays out; the remaining columns were dropped (see Resolution status).

**Audit Log**
- P1: The log only records lead create/update/delete and security events. **Booking approvals and cancellations, payments recorded or waived, plot price changes, commission approvals and payouts, staff deactivation, and PII changes are not logged** — the actions that matter most for a 7-year audit trail.

---

## Suggested order

1. **RLS fixes (one migration):** split `bookings_access_scoped` and `payments_access_scoped` so advisors can insert or read but not change `status`, `approved_*` or `amount_paid`; limit `plots_update` to managers and move holds into a SECURITY DEFINER RPC; limit `construction_milestones` deletes to managers.
2. **Staff management:** run HR edit, deactivate, Team toggle and role changes through an admin-checked service-role action (or add a `profiles` UPDATE policy for admins and managers in the hierarchy). Restrict `addJunior` roles to manager, sales_advisor and telecaller, and never above the caller's own role.
3. **Lead → client conversion:** add a "Convert to client" button on the lead page that pre-fills ClientForm with `lead_id`, and a lead picker in ClientForm.
4. **Reports:** fix the stage lists in `getLeadFunnel` and `getLeadAgeing` against `lead_stage`, then move the report counts into SQL functions.
5. **Attendance:** use one table (point the mobile API at `attendance_logs`, or union the two).
6. **Price escalations:** add a pg_cron job that applies due escalations and marks them applied.
7. Audit-log coverage, the consent logging calls, the loan docs/notes editor, the complaints queue, file uploads.
8. P2/P3 items.

---

## Resolution status (2026-10-21)

Plan: [MENU_FIX_PLAN_2026-10-20.md](MENU_FIX_PLAN_2026-10-20.md). All items below are fixed in code; the
database changes are applied to production (`dfjyslxrzniqtlniseat`). Checks: `tsc` clean, `npm test`
328/328 (15 new in `tests/actions/menu-audit.test.ts`), `npm run test:db` 278 selects / 238 writes,
`next build` clean for CRM and website, and `tests/sql/04_menu_audit_guards.sql` passing on production
(rolled back).

**Found while fixing (not in the audit):**
- **P0 — adding, bulk-adding and editing plots failed.** The code wrote `plots.total_price`, a generated column. Fixed, and `test:db` now flags writes to generated columns.
- **Plot premiums were in the wrong unit.** The form took corner/facing premiums as ₹, but the database formula treats them as % of the base price. The form, plot panel and cost sheet now use %.
- **Inventory report "Held" was always 0** (filtered `held`, not `soft_hold`).
- **HR "Late" badge never fired** (server UTC clock); **HR employee list included broker logins**.
- **`writeAuditLog` was callable from any browser** (`'use server'` file), so audit entries could be forged. It's now a plain module, and the staff insert policy on `audit_logs` is dropped.
- Payroll slip edits compounded loss-of-pay on every re-save.

| # | Item | Status |
|---|------|--------|
| 1 | Advisors approving bookings / marking payments | Fixed: guard triggers on bookings, payments, clients.kyc_status (migration `20261023100000`) |
| 2 | Staff edit / deactivate silently failing | Fixed: `lib/team/staff.ts` (service role, caller checked, auth ban, sessions revoked, audited); Reactivate button; admin role/branch/team editor |
| 3 | addJunior role escalation | Fixed: role allow-list + rank check (UI filters too) |
| 4 | No lead → client conversion | Fixed: Convert to client / View client on lead page; prefilled form; one client per lead; client page links lead, New booking, loans |
| 5–6 | Lead Ageing / Funnel | Fixed (real stages; ageing uses `stage_changed_at`) |
| 7 | Mobile attendance in a separate table | Fixed: mobile API + admin page use `attendance_logs` |
| 8 | Price escalations never applied | Fixed: `apply_due_price_escalations()` + daily pg_cron at 00:05 IST |
| — | plots writable by any staff | Fixed: guard trigger (holds only, own holds) |
| — | Milestone delete by advisors | Fixed (policy + action + UI) |
| — | Leads filters / toggle / bulk actions / merge / Link-in-Button | Fixed |
| — | Complaints queue | Added `/clients/complaints` |
| — | File uploads | Added private `crm-files` bucket, signed uploads, `/api/files` access-checked links; used for client & project documents, agreement, construction photos, legal templates, client photo, WhatsApp attachments |
| — | Allotment letter "sent" without sending | Fixed: emails the PDF; separate "Mark as handed over" |
| — | Payment schedule / construction demands | Booking amount installment on approval; payment-trigger milestones raise installments on construction-linked bookings + demand email |
| — | Loans docs / notes | Editable on the loan page |
| — | Reports 1,000-row cap / SLA URL overflow / mixed periods | Fixed: `fetchAll` paging, chunked `in()`, one date range |
| — | Audit coverage | Booking approve/reject/cancel, installments add/delete, payments record/waive, plot edits, commissions approve/pay, client edits/KYC, staff changes, unlocks |
| — | DPDP consent never logged | Website form, CRM lead form checkboxes, WhatsApp STOP/START (both webhooks) |
| — | Legal templates not editable | Fixed |
| — | Security: unlock, session timeout, IP allowlist lockout, validation | Fixed (idle timeout enforced in proxy; allowlist refuses to enable without your IP) |
| — | HR leave entitlements / payroll slip adjust | Added |
| — | Premium matrix / hold history / my holds | Added |
| — | WhatsApp media from inbox, conversation stats | Added (`lib/whatsapp/media-actions.ts`) |
| — | Automation queued runs | Shown on Automation page |
| — | Manager-only pages open by URL; dashboard modules | Server-side gates on HR, Legal, Automation, Brokers, financial reports; dashboard grid follows role |

**Two-factor authentication: removed completely** (2026-10-21): the app code went in `c0d46f0`; the unused `profiles.two_factor_enabled` / `two_factor_secret` columns, the trigger that referenced them and the `2fa_*` audit actions are gone too (migration `20261023100400`).

**Not changed (decisions):** IP allowlist can't cover direct
Supabase API calls; commission maker/checker; bank / DSA detail pages (edit forms exist on the lists);
Marketing (owned by the parallel session — its UI-rule warning at `marketing/page.tsx:173` is theirs).
