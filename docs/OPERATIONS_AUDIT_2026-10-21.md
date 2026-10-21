# Operations menus audit: Team, HR, Automation, Legal (2026-10-21)

This is a deeper pass than the 2026-10-20 menu audit, and it re-checks the fixes from that audit.
Items marked **[verified]** were reproduced against production inside transactions that were rolled back (nothing was changed).

Severity: **P0** = data integrity or money at risk, or a feature fully broken · **P1** = a broken feature or a real abuse path · **P2** = wrong or misleading behaviour · **P3** = polish.

---

## Top issues (fix first)

| # | Sev | Menu | Issue |
|---|-----|------|-------|
| 1 | P0 | HR / Team | **Any staff member can edit their own salary, team, targets and HR fields** through the API using their own login. `profiles_update_own` has no column list, and the `profiles_freeze_privileged_self` trigger only freezes role / is_active / branch / reporting manager / lockout. Payroll reads `base_salary` directly. **[verified]**: as a sales advisor, `update profiles set base_salary=999999, team_id=null, monthly_target_revenue=1` → 1 row. |
| 2 | P0 | Automation | **Delayed automations never run.** The cron claims each queued run with `status='running'`, but `automation_pending_executions_status_check` only allows pending/executed/cancelled/failed. The claim fails, so the run is skipped and stays `pending` forever. **[verified]** |
| 3 | P0 | Automation | **3 of the 6 actions can't be saved:** `send_notification`, `change_lead_stage` and `assign_to_advisor` violate `automations_action_type_check`, which still lists old names (send_push, change_stage, assign_lead…). Two built-in templates (Notify advisor, Follow-up overdue) also fail to install. **[verified]** |
| 4 | P1 | HR / Team | **Employees can approve their own leave and backdate attendance.** Under `leave_insert`/`leave_update` and `attendance_insert`/`attendance_update`, the owner can write any `status`. **[verified]**: an advisor inserted a leave already `approved` and a "present" record dated 20 days ago. Approved unpaid leave feeds payroll loss of pay. |
| 5 | P1 | HR | **Managers control payroll and balances org-wide, including their own.** `payroll_runs`, `payroll_slips` and `hr_leave_balances` have ALL policies for any manager. The UI says payroll is admin-only, but the API doesn't enforce that. `updateStaffProfile` also lets a manager target *themselves* (salary, reporting manager), because the service role bypasses the self-freeze trigger. |
| 6 | P1 | Automation | **"Create follow-up" reports success and creates nothing.** It inserts `lead_activities.type='follow_up'`, which isn't in the type check. The error is ignored, so the run is logged as successful. **[verified]** The same invalid literal makes **Team → "follow-ups completed" always 0**. |
| 7 | P1 | Automation | **"Send email" always fails.** The builder has no recipient picker, so the engine falls back to `payload.email_to` (never set) and returns "No email address in context". No trigger context includes an email anyway. |
| 8 | P1 | Automation | **Both live automations fail on every run:** `welcome_lead` and `site_visit_reminder` are *draft* templates. Built-in templates also point to `site_visit_thankyou` and `booking_confirmation`, which don't exist. The approved ones are named `lead_welcome`, `site_visit_confirmation`, `booking_congratulations`, etc. |
| 9 | P1 | Legal | **DPDP erasure can't be run from the UI.** `NewDeletionRequestForm` has no lead/client picker, so `requester_id` is always null and "Mark Completed" returns "not linked to a lead or client". `DeletionRequestActions` ignores the result, so the click silently does nothing. Erasure is also irreversible and has no confirmation step. |
| 10 | P1 | Legal | **Erasure leaves personal data behind.** KYC files in the private `crm-files` bucket aren't deleted (the code only matches `/storage/v1/object/` URLs, but files are now stored as `/api/files/…`). It also misses `automation_logs.lead_name/lead_phone`, `consent_logs.entity_name`, `audit_logs` payloads (lead_created stores the full payload), notification texts, call-recording files (only the URL is cleared), other leads with the same phone, and loan records. |
| 11 | P1 | Team | **Leaderboard revenue and bookings are wrong.** "Revenue" is the sum of `leads.budget_max` for `closed_won` leads, filtered on `updated_at`. That is not booking value, and any later edit to a won lead counts it again in the month of the edit. The incentive slab tracker uses the same numbers. It should use `bookings` (confirmed, `advisor_id`, `total_sale_value`, `booking_date`). |

---

## Team

- **P1**: leaderboard and KPIs are built on the wrong data (#11). Follow-ups are always 0 (#6).
- **P2**: who a manager sees doesn't match the team chain. `getTeamMembers` filters managers by `branch_id`, not their team subtree; a manager with no branch gets `branch_id = null`, which matches nobody. In production the only manager **leads no team**, so every chain-scoped screen shows only themselves.
- **P2**: KPI time windows use UTC. `getDailyKPI` uses `T00:00:00+00:00` and `getMonthlyKPI` uses `new Date(y, m-1, 1)` on a UTC server, so "today" and "this month" are off by 5h30m in IST.
- **P2**: `checkIn` is an upsert. A second check-in (stale tab, or mobile plus web) resets `check_in_at`, and it overwrites a manager-set `on_leave`/`absent` with `present`.
- **P2**: web check-in is only on your own `/team/<id>` page, not on **My Attendance**. My Attendance shows only the current month (no navigation), and you can't cancel a pending leave from there.
- **P2**: anyone who leads a team can create accounts (`addJunior`). The temporary password is shown on screen, there is no forced change on first login and no invite email. The steps aren't atomic, so a failure leaves an orphan auth user or team behind.
- **P2**: deactivating a team leader leaves their team led by an inactive user. Their subtree then becomes visible only to admins. Nothing prompts you to reassign the team.
- **P2**: the `teams` policies let *any* manager edit or delete *any* team. `team_targets` lets any manager set any user's target.
- **P3**: `/team/announcements` has no role check and shows pin/delete buttons to everyone; advisors just get "Forbidden". A manager pinning someone else's post silently does nothing (the update policy is author or admin only). That page also skips the branch filter.
- **P3**: `/team/targets` ignores the `?member=` that "Set Target" links with. Year input NaN isn't guarded. Responses can arrive out of order when you switch months quickly.
- **P3**: incentive slabs (4 rows) have no admin UI; they're SQL-only. The Announcements tab is missing from the Team tabs.
- **P3**: performance: the leaderboard runs about 17 queries per member (4 helpers × 4 queries + attendance). Move it to one SQL function.
- **P3**: `queries.ts` and `teams.ts` are `'use server'`, so read helpers like `getMemberProfile(id)` and `getTeamsData()` are callable from the browser. They're RLS-scoped, but it's unnecessary attack surface.

## HR

- **P0/P1**: self-edit of salary (#1), self-approved leave and backdated attendance (#4), managers controlling payroll and their own record (#5).
- **P2**: the leave-type lists disagree:
  - HR balances offer maternity/paternity, but `leave_requests` rejects them.
  - Employees can apply for `comp_off`, but `hr_leave_balances` rejects it, so approving comp-off never updates a balance (the error only goes to the console). **[verified]**
- **P2**: managers see leave and attendance org-wide, but profiles only through their chain, so names outside the chain show as **"Unknown"**.
- **P2**: payroll calculation:
  - Every month is a fixed 26 days, and loss of pay counts calendar days including Sundays.
  - Attendance is ignored, so an unrecorded absence never reduces pay.
  - No proration for joiners. Anyone deactivated mid-month is dropped from the run, so there's no final-month slip.
  - All 6 active staff have **no `base_salary`**, so slips come out at ₹0 with no warning.
  - Professional tax is hard-coded at ₹200. Rajasthan may not levy PT at all, so check with your CA. PF is uncapped at 12% of basic.
- **P2**: payroll output:
  - Only the latest run's slips can be viewed; history rows aren't clickable.
  - No payslip PDF, no employee "My payslips" page (the RLS policy for it exists), and no bank-transfer export.
  - "Finalize" is shown to managers, but the action is admin-only.
- **P2**: recruitment has no intake. Nothing writes `career_applications` since the website module was removed, but the empty state still says "applications from the careers page appear here".
  - You can't add a candidate manually.
  - "Joined" doesn't create the employee.
  - The public insert policy accepts any column (for example `stage='offer'`). **[verified]**
- **P2**: the interview `datetime-local` value is saved as UTC (a 5h30m shift) and only the date is shown. The `min={today}` on that input is ignored because it's a date, not a datetime.
- **P2**: the employee list shows active staff only, so **Reactivate** can only be reached by URL. Editing an email changes `profiles.email` but not the login email.
- **P3**: the HR home "active employees" count includes broker logins (no role filter). "Open positions" actually counts candidates.
- **P3**: Attendance only shows today: no date picker, no monthly register, and people with no record aren't listed as absent. Approving leave doesn't mark those days `on_leave`.
- **P3**: no format checks on Aadhaar, PAN or IFSC. Managers see decrypted Aadhaar/PAN/bank details for their whole chain.

## Automation

- **P0**: delayed runs never execute (#2). 3 of 6 actions can't be saved (#3).
- **P1**: follow-up action is a no-op (#6), email action is dead (#7), live automations use draft templates (#8).
- **P2**: the "round robin" assignment is `count(all leads) % advisors`. That isn't round robin and it ignores branch and team. Use the existing assignment rules or the least-loaded advisor.
- **P2**: no "Test run" or dry-run, and no warning when a selected template isn't approved. The builder offers draft templates without saying so.
- **P3**:
  - The detail page's log is "global latest 50, filtered by id or name". A busy automation pushes another's history out, and a rename loses its history. Query by `automation_id`.
  - Condition `equals` is case-sensitive ("Facebook" ≠ "facebook").
  - Overdue reminders can go twice within about 20h around IST midnight (`daysOverdue` 0 and then 1).
  - `follow_up_overdue` takes the same 50 unordered leads on every run.
  - The birthday and anniversary scan loads up to 5,000 rows every 15 minutes.
  - "Send Push Notification" is really an in-app notification to *every* user with that role, not the lead's advisor.

## Legal

- **P1**: erasure can't be run (#9) and is incomplete (#10).
- **P2**: RERA:
  - The project form parses the `disclosure_key`/`value` fields and then never saves them (`rera_disclosures` is missing from the update).
  - The next quarterly due date is "today + 3 months". It drifts when a report is filed late; it should follow quarter end plus the statutory deadline.
  - Nothing sends alerts for expiry or quarterly deadlines.
- **P2**: **2 active projects have expired RERA registrations** (Anon Heights, expired 2026-04-14; Anon Greens, expired 2025-08-09), and nothing stops bookings or website listing on them.
- **P2**: "Upload a document" on the project compliance page is a URL text box with `type=url`, which rejects the app's own `/api/files/…` paths. Use `FileUrlInput`. `uploadDoc` also ignores the action result, so errors are silent.
- **P2**: the consent dashboard counts log *events*, not each person's current state. A STOP followed by START shows as 1 in and 1 out. Show the latest row per entity and type.
- **P3**: there's no channel for a data principal (client portal or website) to request deletion or withdraw consent; only staff can log it. Requests have no due date or ageing.
- **P3**: the stats helpers fetch every `consent_logs` and `project_documents` row (1,000-row cap).

---

## Re-check of the 2026-10-20 fixes

- Staff edits via `lib/team/staff.ts`: work. But self-edits through the API are still open (#1), and managers can edit their own record (#5).
- "Automation: delayed runs are executed": **no longer true** (#2). The claim step added later breaks it.
- Leave balances: entitlements can be set now, but comp-off never updates a balance, and maternity/paternity can't be requested.
- Consent logging: wired up (website form, CRM, WhatsApp STOP/START), but there are 0 rows in production so far.

## Suggested fix order

1. **One migration** for:
   - A column guard on `profiles` for self-updates. Allow only phone, photo, emergency contact, address, DOB and bank details; freeze salary, team, targets and employment fields.
   - Owner-insert/update on `leave_requests` limited to `status in (pending, cancelled)`.
   - `attendance_logs` owner writes limited to today, with no status changes.
   - Payroll and leave-balance policies changed to admin-only.
   - Widen `automations_action_type_check` and `automation_pending_executions_status_check` (add `running`), and add `follow_up` to the `lead_activities` type check (or point the action at whatever the lead page's follow-ups use).
   - Line up the leave-type checks across the UI, `leave_requests` and `hr_leave_balances`.
2. Automation: add an email recipient picker and email in the contexts; show approved-only templates; fix the template names; add a test button.
3. Legal: lead/client picker on deletion requests, a confirmation step, surfacing errors; extend `eraseSubject` to `/api/files` paths, logs and recordings; save the disclosures; block bookings on projects with expired RERA.
4. Team KPIs: one SQL function over `bookings`, `lead_activities` and `site_visits`, using IST windows and the team chain.
5. Payroll: attendance-based loss of pay, proration, salary-missing warning, payslip PDF, self-view, history.
6. The P3 items.

---

## Resolution status (2026-10-21)

Database: migration `20261024100000_operations_audit_guards.sql` is **applied to production**. `tests/sql/05_operations_guards.sql` passes on production (24 checks, rolled back).
Checks: `tsc` clean, `npm test` **355/355** (27 new: `tests/actions/operations-audit.test.ts` plus engine cases), `npm run test:db` 290 selects / 245 writes, `next build` clean, smoke test 69/69.

| # | Item | Fix |
|---|------|-----|
| 1 | Self-edit of salary, team, targets | `profiles_freeze_privileged_self` now allows only name, phone, photo, address, DOB and emergency contact on your own row. Everything else goes through `lib/team/staff.ts`. |
| 2 | Delayed automations never ran | `running` added to the pending-executions status check. |
| 3 | 3 of 6 actions couldn't be saved | `automations_action_type_check` now lists the 6 actions the engine runs. |
| 4 | Self-approved leave, backdated attendance | Guard triggers. Owners insert leave only as pending and may only withdraw it; nobody decides their own request. Own attendance: today only, check-in once, check-out once, no status changes. |
| 5 | Managers controlled payroll and their own record | Payroll runs/slips are admin-only (employees read their own finalized slips). Leave balances and targets: managers, for their chain, never their own row. `staff.ts`: managers can't edit their own record, and salary, bank and login email are admin-only. Email changes update the login too. |
| 6 | "Create follow-up" did nothing; follow-ups KPI was always 0 | Now sets `leads.next_followup_at` (the reminder cron picks it up) and adds a system note. The KPI counts calls, WhatsApp, email and SMS. |
| 7 | "Send email" always failed | Recipient picker (lead / client / fixed address); the address is looked up when the trigger context doesn't carry one. |
| 8 | Draft templates | You can't switch on an automation whose template isn't approved. The list and builder flag it, install warns, and built-ins point at approved templates. |
| 9 | Erasure couldn't run | Lead/client picker on the request (server checks it), a confirmation step, errors shown; rejecting needs a note. Erasures are audited (`data_erased`). |
| 10 | Erasure left data behind | Private-bucket files (`/api/files/…` and the client's folder), client photo, duplicate leads with the same phone, loan income/credit/notes, automation logs and queued runs, consent-log names and notifications are now covered. |
| 11 | Leaderboard revenue | Comes from confirmed bookings (sale value, booking date), in IST windows, for the team chain. A handful of queries for the whole team instead of about 17 per member. |
| — | Leave types | One list for Team and HR (casual, sick, earned, unpaid, comp-off, maternity, paternity) matching both DB checks. Sundays don't count toward leave days; overlapping requests are refused; approval marks the days "on leave". |
| — | Payroll | Working days = non-Sunday days in the month. Joiners and leavers are prorated (leavers get their final month); unpaid leave and days marked absent are loss of pay. Employees without a salary are skipped and named. PF is capped at the wage ceiling. Runs can be opened from the history. "My payslips" is on Team → Attendance. |
| — | HR screens | Inactive tab (Reactivate is reachable now). Attendance has a date picker and a "no record" list. Stats exclude brokers. Aadhaar/PAN/IFSC are format-checked. Leave, candidate and payroll buttons show errors. Manual "Add candidate" with resume upload. Interview times are stored in IST and shown with the time. |
| — | Team screens | Check-in no longer overwrites an earlier check-in or a leave day. My Attendance has check-in, month navigation and withdraw. Targets and Announcements are server pages with role gates (and `?member=` opens the editor). Announcements tab added. Pin/delete follow RLS and ask for confirmation. Admins can set a team's leader. Deactivating a leader hands their teams to the parent team's leader. "Add junior" rolls back on failure. `lib/team/queries.ts` is no longer a server-action module. |
| — | Automation | Case-insensitive equals; least-loaded "round robin"; notify the lead's advisor; `{{days}}` token; logs queried by automation; overdue-day count in IST; stalest leads first in the 48h sweep. |
| — | Legal / RERA | Disclosures are saved and shown. The quarterly due date is quarter end + 15 days (`lib/legal/rera.ts`; confirm the grace period with your consultant). Bookings are refused on projects with an expired registration. Compliance documents use a real upload. Consent stats show each person's latest choice. |
| — | Careers | The public insert accepts only a fresh application (`stage = 'applied'`, no review fields). |

**Action needed from you:**
- **Make the manager a team leader** (Team → Teams → "Led by …"). Leave, attendance, targets and the leaderboard now follow the team chain everywhere. In production the only manager leads no team, so they will see nobody until this is set.
- **Both live automations** ("Welcome New Lead (Facebook)", "Site Visit Reminder (Lead)") still point at draft templates (`welcome_lead`, `site_visit_reminder`), so every run still fails. Either get those templates approved or switch each automation to an approved template (`lead_welcome`, `site_visit_confirmation`). I didn't change what gets sent to real leads.
- **All 6 staff have no base salary**, so payroll will refuse to run until salaries are set in HR → Employees.

**Not done (larger features or decisions):**
- Payslip PDF and a bank-transfer export.
- A public careers form.
- "Joined" creating the employee login (use Team → Teams → Add junior).
- A test-run button for automations.
- Forcing a password change for accounts created by Add junior.
- RERA expiry and quarterly-due alerts (the dashboard shows them; nothing notifies).
- Scrubbing audit-log payloads (the audit trail is kept as-is).
- Call recordings stored at the telephony provider.
- An admin UI for incentive slabs.
- A self-service DPDP request channel in the portal or website.
- The professional-tax rate: it's a named constant (`PROFESSIONAL_TAX_MONTHLY`) to confirm with your CA.
