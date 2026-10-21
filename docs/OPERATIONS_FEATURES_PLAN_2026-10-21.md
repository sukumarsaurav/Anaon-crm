# Operations follow-up features: plan (2026-10-21)

Follow-up to [OPERATIONS_AUDIT_2026-10-21.md](OPERATIONS_AUDIT_2026-10-21.md) (fixes committed in `c7e8f50`).
There are seven features, grouped into six phases ordered by dependency. Each phase ships on its own and can be tested separately.

| Phase | Feature | Depends on | Effort |
|---|---|---|---|
| A | Forced password change for new accounts | — | 1 day |
| B | Create a CRM login when a candidate joins | A | 1–1.5 days |
| C | Payslip PDF + bank transfer export | salaries set in HR | 1.5 days |
| D | Incentive slab admin screen (+ incentives pre-filled on payslips) | — (C for the pre-fill) | 1–1.5 days |
| E | RERA expiry and quarterly-report alerts | — | 1 day |
| F | Automation test run | — | 1.5–2 days |
| G | Public careers form → CRM | **decision on the website's database (see G.0)** | 1 day |

Total: about 9 working days. A → B must be in that order; the rest can go in any order.

---

## A. Forced password change for new accounts

**Today:** "Add junior" (`lib/team/teams.ts`) and broker portal access (`lib/brokers/actions.ts`) create accounts with a temporary password and show it on screen. Nothing makes the person change it, so the temporary password works for as long as nobody changes it.

**Design**
- **Flag:** `app_metadata.must_change_password = true` on the auth user. It lives in the JWT, so the proxy reads it from the claims it already verifies (`getClaims()`), with no extra database call. Users can't edit `app_metadata`.
- **Set by:** `addJunior`, broker portal access, the new "Reset password" button (below), and candidate conversion (B).
- **Proxy (`src/proxy.ts`):** when the flag is set, any request other than `/change-password`, `/api/auth/*` and static assets redirects to `/change-password`. API calls get a 403 `{ error: 'password_change_required' }`.
- **Page `(auth)/change-password`:** new password and confirm. Rules: at least 10 characters, not the temporary password, not the email.
- **Route `POST /api/auth/change-password`:**
  1. `supabase.auth.updateUser({ password })` with the user's own session.
  2. Clear the flag with the service role.
  3. `refreshSession()`, so the new JWT no longer carries the flag.
  4. Revoke the user's other `user_sessions` rows.
  5. Audit `password_changed`.
- **Admin "Reset password"** on HR → Employee: sets a new temporary password and the flag, revokes sessions, and shows the password once. It writes to someone else's auth user, so it is admin-only and audited.
- **Mobile API (`lib/mobile/auth.ts`):** refuse a flagged token with a 403 ("Set your password on the web first").
- **Later:** replace on-screen passwords with emailed setup links (`auth.admin.generateLink({ type: 'recovery' })`) once email delivery is proven.

**Files:** `src/proxy.ts`, `src/app/(auth)/change-password/page.tsx`, `src/app/api/auth/change-password/route.ts`, `lib/team/teams.ts`, `lib/brokers/actions.ts`, `lib/team/staff.ts` (`resetStaffPassword`), `lib/mobile/auth.ts`, `lib/security/audit.ts`.
**Tests:**
- Proxy redirect with and without the flag.
- Change-password rules.
- The flag is cleared only after a successful update.
- A manager can't reset an admin's password.
- Mobile refuses flagged tokens.

---

## B. Create a CRM login when a candidate joins

**Today:** moving a candidate to "Joined" only changes their stage. Someone then has to re-enter them through Team → Teams → Add junior, and the candidate and employee records aren't linked.

**Design**
- **"Joined" opens a "Create employee" dialog**, prefilled from the application:
  - name, phone, email
  - `joining_date` (default: today)
  - `base_salary` = offer CTC ÷ 12, rounded
  - role (telecaller / sales advisor / manager, never above the creator's own role)
  - team (the creator's manageable teams)
  - designation and employee ID (default: next `EMP-####`)
- **Extract a shared provisioning module:** move the account creation out of `addJunior` into a plain (non-server-action) module, `lib/team/provision.ts` → `createStaffAccount(input)`. Both `addJunior` and candidate conversion call it. It does:
  1. Create the auth user with the role and the A flag.
  2. Fill in the profile (team, reporting manager, branch, HR fields).
  3. Optionally create a junior team.
  4. Roll back on failure.
  5. Audit `user_created`.
- **Server action `convertCandidateToEmployee(candidateId, input)`** in `lib/hr/actions.ts` (manager or admin; the team must be one they manage). It creates the account, sets the candidate to `joined`, and links the two.
- **DB:** `career_applications.profile_id uuid references profiles(id)`, unique, so the same candidate can't be converted twice.
- **UI:** a joined candidate shows "Employee → <name>", linking to their HR record. The temporary password is shown once, as in Add junior.
- **Guards:** an email that is already registered gives a clear message, with a link to the existing employee when we can see them.

**Files:** `lib/team/provision.ts` (new), `lib/team/teams.ts`, `lib/hr/actions.ts`, `components/hr/CandidateStageActions.tsx`, `components/hr/ConvertCandidateDialog.tsx` (new), `app/(dashboard)/hr/recruitment/page.tsx`, migration.
**Tests:**
- Conversion creates the auth user, profile, link and stage in one go.
- A second conversion is refused.
- A role above the creator's own is refused.
- A failure part-way leaves nothing behind.

---

## C. Payslip PDF + bank transfer export

**Today:** slips exist only as table rows. `@react-pdf/renderer` is already used for allotment letters, demand letters and receipts (`lib/pdf/documents.tsx`, `builders.ts`, `render.ts`, `/api/documents/*`).

**Payslip PDF**
- **`PayslipDoc`** in `lib/pdf/documents.tsx`, in the same style as the receipt. It contains:
  - Company header.
  - Employee details: name, employee ID, designation, department, joining date, PAN masked (`displayPii`), bank account masked.
  - Period, working days, paid days, loss-of-pay days.
  - Earnings: basic, HRA, allowances, incentives.
  - Deductions: PF, PT.
  - Net pay in figures and in words (Indian numbering).
  - "Computer-generated; no signature required".
- **`buildPayslip(slipId)`** in `builders.ts`.
- **Route `GET /api/documents/payslip/[slipId]`:** an admin can open any slip; an employee can open their own slip once the run is finalized (the same rules as RLS). The PDF is generated on demand and not stored, so it always matches the slip. Viewing is audited (`document_viewed`).
- **Buttons:** "PDF" on each row of HR → Payroll and on Team → Attendance → My Payslips; "Download all" (zip) for a run.
- **Optional:** on Finalize, email each employee their slip (the email sender in `lib/email` is already set up). Behind a checkbox, off by default.

**Bank transfer export**
- **Route `GET /api/hr/payroll/[runId]/bank-export?format=generic|hdfc|icici|sbi`:** admin only, finalized runs only. It decrypts account numbers on the server, so it is audited (`export_report`, with the run id).
- **Generic CSV:** beneficiary name, account number, IFSC, amount, narration `SALARY OCT 2026 <EMP-ID>`, email.
- **Bank formats:** each bank's bulk-upload layout is a small column map. Start with the generic format plus the bank you actually use.
- **Missing details:** if an employee has no bank account, no IFSC, or a malformed IFSC, they are left out. A banner lists them before download, and the totals row shows the amount held back.
- **UI:** an "Export for bank" menu on a finalized run.

**Files:** `lib/pdf/documents.tsx`, `lib/pdf/builders.ts`, `app/api/documents/payslip/[slipId]/route.ts`, `app/api/hr/payroll/[runId]/bank-export/route.ts`, `lib/hr/bank-export.ts` (column maps + CSV), `app/(dashboard)/hr/payroll/page.tsx`, `app/(dashboard)/team/attendance/page.tsx`.
**Tests:**
- Payslip access: admin, owner after finalize, owner before finalize (refused), other employee (refused).
- Amount in words.
- CSV escaping.
- Missing-bank exclusion and totals.
- Export refused for a non-finalized run and for a manager.

---

## D. Incentive slab admin screen

**Today:** the 4 slabs (Base 0–2 bookings 0%; Silver 3–5 1%; Gold 6–9 1.5% + ₹25k; Platinum 10+ 2% + ₹50k) can only be changed with SQL. RLS already restricts writes to admins. `lib/team/commission.ts` takes the slab from the month's booking count and pays that slab's % on the whole month's revenue, plus its bonus.

**Design**
- **Page `/team/incentives`:** admins edit, managers read. It's a table of slabs (label, from, to, commission %, bonus ₹, active), with add, edit, delete and reorder.
- **Server actions `lib/team/incentives.ts`** (admin check + audit). Validation rules:
  - The active slabs start at 0, are contiguous, and don't overlap.
  - Exactly one top slab is open-ended.
  - From ≤ to.
  - Commission is 0–10%; bonus is ≥ 0.
  - Save the whole table at once, so it is never half-valid.
- **Preview:** "With N bookings and ₹X revenue this month → slab, commission, bonus". It uses `calculateCommission`, the same function as the member page.
- **Effective dating (decision):** changing slabs mid-month changes this month's projected incentives. To protect the past, payroll D2 copies the computed figure onto the slip at run time, so finalized slips never change. That avoids versioning the slabs table.
- **D2, prefill on payslips:** when a payroll run is generated, each advisor's or telecaller's slip `incentives` = commission + bonus for that month, from confirmed bookings (the same data as the leaderboard). The admin can still adjust the slip. The run notes which slab version was used.
- **Tab:** add "Incentives" to the Team tabs, for admins and managers.

**Files:** `app/(dashboard)/team/incentives/page.tsx`, `components/team/IncentiveSlabsEditor.tsx`, `lib/team/incentives.ts`, `lib/team/commission.ts`, `lib/hr/actions.ts` (D2), `app/(dashboard)/team/layout.tsx`.
**Tests:**
- Validation: gaps, overlaps, two open-ended slabs, negative values.
- Non-admins are refused.
- The prefill matches `calculateCommission` for a seeded month.
- Finalized slips don't change when slabs change.

---

## E. RERA expiry and quarterly-report alerts

**Today:** the Legal dashboard shows expiry and due dates, but nothing tells anyone. Two active projects are already past expiry. Crons run from `vercel.json` (daily) plus the GitHub Actions workflow (every 15 minutes) and authenticate with `CRON_SECRET`.

**Design**
- **Route `POST /api/cron/compliance-alerts`**, daily at 09:00 IST (03:30 UTC) in `vercel.json`. Once a day is enough, so it isn't added to the GitHub Actions schedule. It checks each active project for:
  - RERA expiry at 90, 60, 30, 15, 7 and 1 days, on the day, and then weekly after expiry.
  - Quarterly report due at 15, 7, 3 and 1 days, on the day, and then weekly while overdue. Uses `quarterly_report_due_date`, kept by `nextQuarterlyDue`.
  - In a weekly Monday digest: mandatory documents missing from the checklist (RERA certificate, title, layout, fire NOC).
- **Dedup:** a new table `compliance_alerts(project_id, kind, threshold, sent_on)` with unique `(project_id, kind, threshold)`, written by the service role only. Each alert goes out once, even if the cron re-runs.
- **Recipients:** admins and managers get an in-app/push notification (`notifyUsers`, `action_url` → `/legal/<project>`). There's also one daily email digest to admins, and optionally to `projects.legal_contact` once it holds an email. Make `legal_contact_email` a separate column; it's free text today.
- **Banners:** red on the Dashboard and Legal pages while any active project is expired.
- **Selling block (decision):** bookings are already refused on expired projects. Also hide expired projects' plots from the website listing and inventory "available" API? This needs a business decision.

**Files:** `app/api/cron/compliance-alerts/route.ts`, `lib/legal/alerts.ts` (pure: what is due today → testable), `vercel.json`, migration (`compliance_alerts`, `projects.legal_contact_email`), `app/(dashboard)/dashboard` and `legal/page.tsx` banners, `components/legal/RERAEditForm.tsx` (email field).
**Tests:**
- `alerts.ts` on fixed dates: each threshold fires once, and nothing fires between thresholds.
- Overdue repeats weekly.
- The dedup holds across two runs.
- Cron auth.

---

## F. Automation test run

**Today:** you can only find out whether an automation works by waiting for a real event. Failed runs show up afterwards in the log. Each caller builds the trigger context ad hoc (leads, bookings, crons).

**Design**
- **"Test" panel** on the automation page, with three steps:
  1. Pick a sample record of the trigger's kind. Default: the most recent matching lead, client, payment, booking or milestone; or search for one.
  2. **Preview (no side effects):** does each condition pass (with the actual values), the recipient, the rendered WhatsApp template with variables filled (or which variable is missing), email subject and body, who would be notified, the stage or advisor that would be set, and the delay.
  3. **Optional "Send to me":** WhatsApp or email goes to the tester's own phone or email, never the customer's. Marked `[TEST]`, with its own idempotency key.
- **Engine refactor (`lib/automation/engine.ts`):**
  - `executeAction(automation, ctx, svc, ref, { mode: 'live' | 'preview' | 'self', self })`. In preview, every branch returns `{ preview }` instead of writing; in self, the recipient is swapped for the tester.
  - `explainConditions(automation, ctx)` returns each condition's result.
  - A shared `buildContext(trigger, recordId)` in `lib/automation/context.ts`, so the preview builds the same context as production. Existing callers can move to it over time.
- **Server action `testAutomation(id, { recordId?, mode })`:** managers and admins. Test runs are not written to `automation_logs` and don't touch `run_count`. They are audited as `automation_tested`.
- **Builder:** a "Test before saving" button runs the preview on the unsaved form values.

**Files:** `lib/automation/engine.ts`, `lib/automation/context.ts` (new), `lib/automation/actions.ts` (`testAutomation`), `components/automation/TestRunPanel.tsx` (new), `app/(dashboard)/automation/[id]/page.tsx`, `components/automation/AutomationBuilder.tsx`.
**Tests:**
- Preview makes no writes and no sends, for every action type.
- Self mode never sends to the record's phone or email.
- Condition explanations.
- Missing template variables are reported.
- Not logged and not counted.

---

## G. Public careers form → CRM

**G.0: decide this first.** The website (`website/`) already has a careers page, an apply form (`/api/apply`) and its own admin for job listings. But its `.env.local` points at Supabase project **`kfrrndpuxmtnoeznaeee`**, which is not the CRM's (`dfjyslxrzniqtlniseat`). Applications land in that database, and the CRM has 0 applications for its 6 active listings. Website leads are inserted the same way (`/api/lead`).
→ **Check the website's production environment on Vercel.** If it also points away from the CRM project, website leads aren't reaching the CRM either. That would be a bigger problem than careers.

**Recommended design** (it works whichever database the website uses):
- **CRM endpoint `POST /api/webhooks/careers`:** shared-secret auth (`CAREERS_WEBHOOK_SECRET`), rate limit, honeypot field. It validates the fields and inserts with `stage='applied'` (the public-insert policy from the audit migration applies the same rule).
- **Resume upload:** the website first asks the CRM for a one-time signed upload slot (`POST /api/webhooks/careers/upload`). The slot is in `crm-files/hr/applications/…` and accepts PDF or Word only, up to 5 MB. The file goes straight from the browser, and the application stores the `/api/files/...` link.
- **Listings:** the CRM is the source of truth (`career_listings`). Add HR → Recruitment → "Openings" (create, edit, close), and a public `GET /api/public/careers` that the website reads, cached for 5 minutes. Retire the website's own careers admin.
- **On a new application:** notify HR managers in-app and send the applicant an acknowledgement email.
- **Consent:** record consent to store the CV (DPDP).

**Files:** CRM: `app/api/webhooks/careers/route.ts`, `.../upload/route.ts`, `app/api/public/careers/route.ts`, `app/(dashboard)/hr/recruitment/openings/page.tsx`, `lib/hr/listings.ts`. Website: `components/CareerListings.tsx`, `app/api/apply/route.ts` (forward to the CRM), remove `app/admin/careers`.
**Tests:**
- Webhook auth, validation, and that public stage/review fields are ignored.
- The upload slot is limited by type, size and path.
- The listing feed shows active listings only.

---

## Decisions needed before starting

1. **G.0:** which database the production website writes to (and whether website leads reach the CRM).
2. **C:** which bank's bulk-upload format you use, and whether payslips should be emailed on Finalize.
3. **D:** confirm the incentive rule. Today the slab is chosen by the month's booking count and its % applies to the whole month's revenue (not marginal), plus the slab bonus. Should incentives pre-fill payslips?
4. **E:** alert recipients (admins and managers? the legal contact?), and whether expired projects should disappear from the website and the inventory "available" lists.
5. **A:** whether on-screen temporary passwords are acceptable for now, or whether to go straight to emailed setup links.

---

## Status (2026-10-21): implemented

Decisions taken: on-screen temporary passwords stay for now (5); generic bank CSV, with emailing payslips an opt-in checkbox at Finalize (2); the current incentive rule, with incentives pre-filled on payslips (3); alerts go to admins and managers plus the project's legal contact email, and expired projects are not hidden from the website (4); the CRM side of careers is built, and the website switches over only when it is configured (1).

**Database (applied to production):**
- `20261024110000_candidate_profile_link` (`career_applications.profile_id`; the public insert can't set it)
- `20261024120000_compliance_alerts` (`compliance_alerts` table; `projects.legal_contact_email`)
- `20261024130000_careers_intake` (`career_applications.source`, `cv_consent_at`)

| Phase | What shipped |
|---|---|
| A | `app_metadata.must_change_password` is set by Add junior, broker portal access, candidate conversion and admin "Reset password" (HR → Employee). The proxy sends flagged users to `/change-password` (APIs get a 403), and the mobile API refuses them. `POST /api/auth/change-password` enforces the password rules, clears the flag and refreshes the session. Settings → Security links to it. |
| B | "Joined — create login" on an offer opens a dialog prefilled from the application (salary = offer ÷ 12, next `EMP-####`). It creates the account with the code shared with Add junior (`lib/team/provision.ts`) and links the candidate; a second conversion is refused. "Joined (no CRM login)" is still there for roles that don't use the CRM. |
| C | Payslip PDF at `/api/documents/payslip/[slipId]`, for admins or the owner once the run is finalized. PDF links on HR → Payroll and My Payslips. Bank CSV at `/api/hr/payroll/[runId]/bank-export` (admin, finalized runs, audited), with a banner listing anyone held back. Finalize notifies everyone in-app, with optional email. Also fixed: the ₹ sign printed as "¹" on every PDF (allotment, demand, receipt). |
| D | Team → Incentives: admins edit, managers view. Validation: contiguous from 0, one open-ended top slab, 0–10%. Includes a preview. Payroll pre-fills each seller's incentive from confirmed bookings. |
| E | `/api/cron/compliance-alerts`, daily at 09:00 IST (`vercel.json`). Expiry alerts at 90/60/30/15/7/1/0 days and weekly after; quarterly report at 15/7/3/1/0 days and weekly overdue; missing documents on Mondays. De-duplicated in `compliance_alerts`. Sends in-app alerts to admins and managers and an email digest to admins and the legal contact. Plus a red dashboard banner while any active project is expired. |
| F | "Test on a real record" in the automation builder (also tests unsaved changes). Shows each condition with its actual value and the exact message, recipients and changes. "Send test to me" sends only to the tester. Not logged and not counted. |
| G | CRM: `POST /api/webhooks/careers` and `/careers/upload` (secret `CAREERS_WEBHOOK_SECRET`), plus `GET /api/public/careers`, and HR → Recruitment → Openings. Website: `/api/apply` forwards to the CRM and `/api/apply/upload` gives a CV slot. Openings are read from the CRM, the form gets a CV upload and consent checkbox and a honeypot. This all happens only when `CRM_BASE_URL` and `CRM_CAREERS_SECRET` are set. |

**Tests:** 376 passing (`tests/actions/operations-features.test.ts`, engine test-run cases, `tests/unit/payslip.test.ts`). `test:db` 319/249. Both builds and the smoke test pass.

**To switch the website's careers over to the CRM:**
1. Set `CAREERS_WEBHOOK_SECRET` (a long random string) on the CRM's Vercel project.
2. On the website's project, set `CRM_BASE_URL` (the CRM's URL) and `CRM_CAREERS_SECRET` (the same string).
3. Redeploy both.
4. Recreate the website's openings in HR → Recruitment → Openings (the CRM already has 6 active ones), then remove the website's own `/admin/careers`.
5. This does not settle G.0 (where website leads go). Check that separately.

**Still open:** emailed password-setup links instead of on-screen passwords; zip download of all payslips; bank-specific CSV layouts (add to `BANK_FORMATS` in `lib/hr/bankExport.ts`).
