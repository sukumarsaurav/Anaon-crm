# ANON INDIA CRM — Functional Audit

**Date:** 2026-10-20 · **Scope:** `crm/` (Next 16, ~98 dashboard/portal pages, 27 API routes, 40+ server-action files)
**Method:** static audit — code, migrations, config, env. `tsc` is clean; the code references no table missing from the migrations.
**Live DB checked (Supabase MCP, project `dfjyslxrzniqtlniseat`):** migrations, RLS policies, advisors, extensions and row counts. See section 8.
**Still not verified:** production env vars and runtime logs (the CRM is not in the connected Vercel team, which lists only `agency-x` and `freeprep`), and the UI in a browser.

Severity: **P0** = feature broken or data wrong · **P1** = feature unreachable / silently dead · **P2** = degraded or incomplete · **P3** = hygiene.

---

## 1. Summary

| # | Sev | Area | Problem |
|---|-----|------|---------|
| 1 | P0 | Leads | Logging a call/activity breaks the lead update (`rpc('increment')` does not exist) |
| 2 | P0 | Inventory | Soft-held plots never auto-release (nothing calls `release_expired_holds()`) |
| 3 | P0 | WhatsApp | CRM chatbot and auto-reply rules never run under AgencyX; the UI configures rules that never fire |
| 4 | P1 | Telephony | Exotel webhook rejects every call: `EXOTEL_WEBHOOK_TOKEN` is read but not defined or documented |
| 5 | P1 | Brokers | `broker_commission_approved` automation never fires (the batch-approve path doesn't call it) |
| 6 | P1 | Loans | Loan applications cannot be created from the UI (no `/loans/new`, no form) |
| 7 | P1 | Client portal | Payment-extension requests are submitted by customers but staff have no review UI |
| 8 | P1 | Legal/DPDP | Deletion requests only blank name/phone/email on the lead; consent logging has no UI |
| 9 | P2 | Automation | Delayed actions (minutes/hours) are processed by a once-daily cron, so they fire up to ~24h late |
| 10 | P2 | WhatsApp | Templates cannot be edited, deleted or resubmitted after rejection (actions exist, no UI) |
| 11 | P2 | HR/Team | Employee deactivate, leave-balance, payroll-slip edit, member profile edit and toggle have no UI |
| 12 | P2 | Marketing/Website | Campaign spend edit/delete, career listing edit and testimonial create have no UI |
| 13 | P2 | Integrations | Many integrations are code-complete but depend on secrets that were empty in `.env.local` |
| 14 | P3 | Leads UI | "Lead" and "Score" column sort buttons do nothing |
| 15 | P3 | Reports | SLA report assumes fewer than 2000 leads per date range |
| 16 | P3 | Lint | 117 ESLint errors (mostly `no-explicit-any`) |

---

## 2. P0 — broken

### 2.1 Lead activity logging corrupts the follow-up update
`src/lib/leads/actions.ts:243` sets `follow_up_count: supabase.rpc('increment', {...})`.
- No `increment` function exists in any migration.
- The code passes an un-awaited query builder as the column value instead of a number.
- The `leads` update that follows (`last_contacted_at`, `next_followup_at`, `followup_reminder_sent_at = null`) is likely to fail or be rejected.
- Effect: after a call or note, the follow-up date doesn't move, reminders can re-fire, and lead re-scoring uses stale data.
- **Fix:** read-then-write `follow_up_count + 1`, or add an atomic SQL function and `await` it.

### 2.2 Soft holds never expire
`plots.status = 'soft_hold'` with `held_until` is set by `softHoldPlot` (`inventory/actions.ts:208`).
- `release_expired_holds()` exists, but nothing calls it: no `pg_cron` in the migrations, and `vercel.json` has only 4 crons (followups, site-visits, automations, broadcasts).
- Execute is revoked from `anon` and `authenticated` by the security migrations, so it can only run as `service_role`.
- Effect: a held plot stays held forever, and each advisor's `max_holds_per_advisor` cap fills up permanently. *Verify:* check `select * from cron.job` in the DB in case a job was added by hand.
- **Fix:** add `/api/cron/release-holds` (service client, `CRON_SECRET`), schedule it hourly, and write the release to `plot_holds_log`.

### 2.3 CRM chatbot and auto-reply are dead under AgencyX
- `processBotMessage` (`lib/whatsapp/chatbot.ts`) and `runAutoReplyRules` (`lib/whatsapp/auto-reply.ts`) are called only from the legacy Meta webhook (`api/webhooks/whatsapp/route.ts`).
- That route fails closed without `WHATSAPP_APP_SECRET`, which isn't set, and it isn't the registered webhook now that AgencyX owns the number.
- The AgencyX webhook (`api/webhooks/agencyx/route.ts`) mirrors messages and creates leads, but never runs the bot or the rules.
- Both modules reply through `provider.sendTextMessage`, which goes straight to Meta and needs `WHATSAPP_ACCESS_TOKEN`; that isn't set either.
- Effect: the `/whatsapp/auto-reply` page saves rules that never fire. This is also the only place the CRM's own lead chatbot runs.
- **Fix, either:** (a) run auto-reply and bot from the AgencyX `whatsapp.message.received` handler and send through `sendWhatsAppText` (AgencyX); or (b) retire the CRM bot and rules, hide the page, and use AgencyX's own chatbot and keyword rules (the `chatbot.lead.captured` event is already handled). Option (b) is simpler and avoids two bots answering the same chat.

---

## 3. P1 — unreachable or silently dead

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| 4 | Exotel call-status webhook returns 401 for everything | `api/webhooks/exotel/route.ts:6` reads `EXOTEL_WEBHOOK_TOKEN`; it is absent from `.env.local` and `DEPLOYMENT.md`. Call recordings, durations and inbound-call logging never land. | Define the env var, append `?token=` to the Exotel callback URL, document it |
| 5 | `broker_commission_approved` is never fired | The only call is in `bookings/actions.ts:326` inside `approveCommission`, which nothing imports. The UI uses `approveCommissionBatch` (`brokers/actions.ts:159`), which has no `fireAutomations` or `notify`. | Fire the automation (and notify the broker) in the batch path; delete the dead duplicates |
| 6 | No way to create a loan application | `createLoanApplication` is unused and there is no `/loans/new` route. `loans/page.tsx` links only to banks and DSAs. | Add a "New application" form from a booking or client page |
| 7 | Extension requests can't be reviewed | `reviewExtensionRequest` (`portal/actions.ts:191`) is unused. Customers submit through `PaymentExtensionForm`, and requests pile up in `payment_extension_requests`. | Add an approve/reject panel on the client or payment page |
| 8 | DPDP erasure is incomplete | `legal/actions.ts:156-185`: a "completed" request blanks only `full_name`/`phone`/`email` and sets `is_active = false` (lead branch checked; clients/brokers not verified). Related activities, WhatsApp messages, documents and notes remain. `logConsent`, `updateLegalTemplate` and `toggleLegalTemplate` have no UI. | Cascade anonymization (activities, messages, documents, storage), add consent logging and template management |
| 8b | Broker login linkage *verify* | `linkBrokerAuthUser` has no UI caller; broker-portal pages need a linked auth user. If `createBroker`/`approveBroker` doesn't link one, approved brokers can't log in. | Confirm in the DB; otherwise wire it into the approve flow |

---

## 4. P2 — degraded or incomplete

- **Delayed automations (9).** `automation_pending_executions` is drained only by the `/api/cron/automations` step at `0 2 * * *`. A "send WhatsApp 30 minutes after visit" rule fires the next night. Add an every-5-minutes drain (Vercel Pro, pg_cron + `pg_net`, or an AgencyX-side scheduler); on Hobby, only daily is possible.
- **WhatsApp templates (10).** `updateTemplate`, `resubmitRejectedTemplate` and `deleteTemplate` have no UI. A Meta-rejected template can't be fixed from the CRM.
- **HR/Team (11).** No UI for: `deactivateEmployee`, `setLeaveBalance`, `updatePayrollSlip`, `updateMemberProfile`, `toggleMemberActive`, `markAttendance` (web; the mobile API works). Leavers can't be deactivated, and payroll slips can't be corrected after generation.
- **Marketing/Website (12).** No UI for: `updateCampaignSpend` (so campaign ROI/CPL reports have no spend unless entered elsewhere), `deleteCampaign`, `updateCareerListing`, `createTestimonial`, `toggleTestimonialActive`, `savePremiumMatrix` (plot premium pricing), `assignComplaint`.
- **Bookings.** `uploadAgreement` and `markAllotmentLetterSent` have no UI, so no agreement upload and no "letter sent" state.
- **Brokers.** `updateLeadRegistrationStatus` has no UI, so broker lead-registration disputes can't be resolved.
- **Integrations (13).** Empty in the local `.env.local`:

  | Feature | Variables |
  |---|---|
  | AgencyX send/webhook | `AGENCYX_API_KEY`, `AGENCYX_WEBHOOK_SECRET`, `AGENCYX_FROM` |
  | Razorpay pay-now and webhook | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
  | Email | `RESEND_API_KEY` |
  | Push | `EXPO_ACCESS_TOKEN`, `VAPID_*`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` |
  | Click-to-call | `EXOTEL_*` (plus the undocumented `EXOTEL_WEBHOOK_TOKEN`) |

  Each feature fails closed (503 or "not configured"), which is safe. You've said AgencyX is now connected, so confirm the values are set **in the production host**, not just locally.
- **Other things that depend on the AgencyX connection.**
  - The WhatsApp OTP template `otp_login` (or `WHATSAPP_OTP_TEMPLATE_NAME`) must be Meta-approved in the Authentication category. Otherwise the portal OTP falls back to MSG91 SMS, which needs a DLT-approved template.
  - Every inbound WhatsApp contact becomes a lead, including existing clients, brokers and staff numbers. Consider a lookup against `clients`/`brokers`/`profiles` first.

---

## 5. P3 — hygiene

- `LeadsTable.tsx:77,86` — sort buttons have no handler.
- `reports/queries.ts:156` — `.in('lead_id', ids)` is unbounded beyond ~2000 leads, so the SLA report silently undercounts for wide date ranges.
- `lib/whatsapp/provider.ts` — Meta-direct code kept as a fallback, with `require('crypto')` and a module-level token read; keep it or delete it, but not both half-alive.
- 117 ESLint errors, of which about 100 are `no-explicit-any` (`reports/queries.ts`, `pdf/*`, `push.ts`, `exotel.ts`, razorpay webhook).

---

## 6. Verified working (in code)

- **Automation engine:** all 16 trigger events are fired from real code paths, all 6 action types are implemented, and runs are idempotent per record (per day for daily triggers).
- **Razorpay:** order creation → HMAC-verified webhook → idempotent on `razorpay_payment_id` → marks the installment paid → fires `payment_received` → emails the receipt PDF. Dead until keys are set; nothing blocks it in code.
- **AgencyX webhook:** HMAC with a 5-minute replay window; handles lead ads, inbound/outbound mirroring, statuses, opt-out, template status and chatbot lead capture; media is persisted.
- **Portal OTP:** the OTP is not returned in the response, hashing and rate limits are in SQL, and delivery is WhatsApp then SMS.
- **Security:** login lockout runs server-side, 2FA, IP whitelist, audit logging; server actions I sampled carry role checks; cron routes are guarded by `CRON_SECRET`.
- **Navigation:** every internal `href`/`push`/`redirect` resolves to an existing page. No mock or demo data, TODO stubs or empty click handlers were found.

---

## 7. Recommended order

1. **Today (P0):** fix `follow_up_count`; add the hold-release cron; decide on the bot (option 3b: retire the CRM bot and rules and use AgencyX's).
2. **This week (P1):** `EXOTEL_WEBHOOK_TOKEN`; fire the commission automation; add the loan-application form and the extension-review panel; complete the DPDP cascade.
3. **Next (P2):** a frequent pending-execution drain; template edit/delete/resubmit; HR and team admin actions; marketing spend and testimonials.
4. **Then:** confirm production env, the `cron.job` list and the RLS advisors directly in Supabase and the deploy host. Those are the checks this audit could not do.

---

## 8. Live database findings (added after Supabase access)

| Check | Result | Effect on the report |
|---|---|---|
| `pg_cron` extension | **Not installed** (extensions: plpgsql, pg_stat_statements, uuid-ossp, pgcrypto, supabase_vault, pg_trgm) | Confirms #2: no database-side schedule can release holds |
| `increment()` function | **0 matches** | Confirms #1 |
| Plots in `soft_hold` | 3 (none expired yet) | #2 will start to bite as soon as these pass `held_until` |
| Approved brokers with no `auth_user_id` | **3 of 3 approved** (+1 pending unlinked) | **Confirms 8b: no approved broker can log into the broker portal.** `linkBrokerAuthUser` has no UI |
| Active `auto_reply_rules` | 5 | Confirms #3: five rules exist and none can fire |
| AgencyX webhook | Working: 1 inbound message mirrored at 2026-10-20 01:02 UTC (conversation `source = agencyx`) | Webhook + signature path is live |
| Outbound WhatsApp | 0 outbound rows | Send path not yet exercised end to end |
| `automation_logs` | 2 failed: "Choose a WhatsApp template or write a message", "No phone number in context" | Automations were saved with an incomplete action config; the form allows this |
| Active automations | 3 | |
| Loan applications | 0 | Matches #6: the feature has never been usable |
| Razorpay orders | 0 payments with an order id | Online payment has never been exercised |
| Push tokens / notifications | 0 / 0 | Push and in-app notifications have never run |
| WhatsApp templates | 6 approved, 8 draft | Drafts cannot be edited or deleted from the CRM (#10) |
| Pending extension requests / deletion requests | 0 / 0 | No backlog yet |
| Edge functions | none | Expected; everything runs in the Next app |
| Last logged `call` activity | 2026-05-23 | Looks like seed data; nothing recent exercised #1, so it remains a code-level finding |

### 8.1 New P0 — RLS lets any signed-in user write sensitive tables
These policies have `USING true` / `WITH CHECK true` for the `authenticated` role (live `pg_policies`):

- **HR and payroll:** `payroll_runs`, `payroll_slips` (read **and** write, `ALL`), `hr_leave_balances`
- **Finance:** `loan_applications`, `loan_disbursements` (`ALL`), `broker_commissions` (insert), `brokers` (insert)
- **Config:** `automations` (`ALL`; an automation can send WhatsApp and change lead stages), `automation_pending_executions`, `assignment_rules`, `whatsapp_templates`, `whatsapp_broadcasts`, `whatsapp_broadcast_recipients`, `auto_reply_rules`, `chatbot_sessions`, `marketing_campaigns`, `campaign_spend_logs`, `teams`, `team_members`, `developers`, `property_albums`, `complaints`, `construction_milestones`
- **Data integrity:** `audit_logs` (insert), `notifications` (insert), `leads` (insert), `lead_activities` (insert), `site_visits` (insert/update), `whatsapp_messages` (insert/update), `whatsapp_conversations` (`ALL`)

**Why it matters:** brokers and other external users also sign in with Supabase Auth, so they are `authenticated`. Anyone with a broker login, and any telecaller using the public anon key from the browser, could read payroll slips or change loans, automations and templates by calling the REST API directly, bypassing the app's role checks. It is dormant today only because no broker is linked (8b); linking the three approved brokers would expose it.
**Fix:** restrict write policies to staff roles, e.g. `current_user_is_admin_or_manager()` or a `profiles.role` check, and make payroll and HR tables manager/HR only. The 2026-09-25 security migrations tightened other tables; these were missed or added later.

### 8.2 Other advisor results
- Security: `pg_trgm` in `public`, leaked-password protection disabled, too few MFA options at the Supabase Auth level, and `current_user_is_admin_or_manager()` / `current_user_visible_members()` callable by signed-in users (low risk; they only report on the caller).
- Performance: 154 unused indexes (informational) and 30 tables with multiple permissive policies for the same role and action (e.g. `leads`, `plots`, `complaints`, `broker_commissions`); merging them would help query planning.

### 8.3 Updated priority
1. **P0 now:** fix RLS write policies (8.1) before linking any broker; fix `follow_up_count`; add the hold-release cron route; decide the chatbot/auto-reply path.
2. **P1:** link the 3 approved brokers (add the link step to the approve flow); `EXOTEL_WEBHOOK_TOKEN`; commission automation; loan form; extension review; DPDP cascade.
3. **P2:** automation config validation (two saved automations can never run), delayed-execution drain, template and HR admin screens.

---

## 9. Resolution status (2026-10-20, after fixes)

| # | Item | Status | How |
|---|------|--------|-----|
| 1 | Activity logging (`increment`) | **Fixed** | Read-then-write counter in `leads/actions.ts` |
| 2 | Holds never release | **Fixed** | `pg_cron` job `release-expired-plot-holds` every 15 min (live, verified) |
| 3 | CRM auto-reply / bot under AgencyX | **Corrected, not a bug to port** | Audit was wrong to call for running the CRM bot there: `agencyx-mirror.ts` deliberately leaves AgencyX threads to AgencyX's own bot (inbox Bot ON/OFF switch drives it); a second bot would double-reply. Fixed the misleading part: the auto-reply page now says the rules are not applied when AgencyX is connected |
| 4 | Exotel webhook token | **Fixed locally; set on host** | `EXOTEL_WEBHOOK_TOKEN` generated in `.env.local`, documented in both `DEPLOYMENT.md` copies. **Set the same value on the production host and in the Exotel callback URL** |
| 5 | Commission automation | **Fixed** | `approveCommissionBatch` fires `broker_commission_approved` and notifies the broker; dead duplicates removed |
| 6 | Loan applications | **Fixed** | `/loans/new` + form, button on `/loans` |
| 7 | Extension requests | **Fixed** | `/clients/extension-requests` with approve/reject; approving now actually moves the payment due date (it did not before); manager-only check added |
| 8 | DPDP erasure | **Fixed** | New `lib/legal/erasure.ts`: WhatsApp threads/media, KYC documents + files, notes, recordings, identity anonymised; request stays open if any step fails. The old code set NOT NULL `phone` to null, so its update always failed silently and **nothing was ever erased** |
| 8b | Broker portal login | **Fixed** (was worse than reported) | `broker` was not a valid role, the login route rejected non-staff roles, and the portal gate required `role = 'broker'`, so the portal was unreachable. Added the enum value, `grantBrokerPortalAccess` (creates the login, one-time temp password, button on the broker page), login/proxy routing to `/broker-portal`, deactivation bans the login |
| 9 | Delayed automations | **Not a defect** | `DEPLOYMENT.md` already documents a GitHub Actions workflow hitting the cron routes every 15 min; it needs the `CRON_BASE_URL` and `CRON_SECRET` repo secrets |
| 10 | Template edit / resubmit / delete | **Fixed** | Buttons on `TemplateCard` |
| 11 | HR / team admin | **Partly fixed** | Employee deactivate, team member activate/deactivate. Login now rejects deactivated accounts (previously `is_active = false` did not stop sign-in). **Not done:** payroll-slip edit, leave balance, member profile edit form |
| 12 | Marketing / website | **Partly fixed** | Campaign delete. **Not done:** career-listing edit, testimonials (no page exists), premium matrix |
| – | Complaint assignment, broker registration status, allotment-letter-sent, agreement upload, legal template toggle | **Fixed** | Buttons on existing pages (`ActionButton`) |
| 13 | Empty integration secrets | **Needs you** | Set on the production host |
| 14–16 | Sort buttons, SLA 2000 limit, lint | **Not done** | Cosmetic / minor |
| 8.1 | RLS `USING true` writes | **Fixed** (live) | Migration `20261020100100`: every authenticated-wide write policy replaced with staff / admin-manager checks; payroll and leave balances manager-only plus own-record read; anon `chatbot_sessions` and `auto_reply_rules` access removed. Verified by role simulation (telecaller and a no-profile user denied; manager passes the policy). Re-query shows no remaining open write policies except `service_role` and the public careers form |

Still open and outside code: leaked-password protection and a second MFA method (Supabase Auth dashboard), confirming sign-ups are disabled (new profiles default to `sales_advisor`), and the production env vars.
