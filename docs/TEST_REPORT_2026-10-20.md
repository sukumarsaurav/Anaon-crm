# Test report — bugs found while writing the suite

265 Vitest tests + 78 SQL checks + 69 smoke checks. Everything below was found by a failing test, then fixed (or flagged).

## Fixed
| Area | Bug |
|------|-----|
| WhatsApp variables | Substring matching: "first name" was an amount (`rs`), "payment terms" / "confirmation" were the advisor (`rm`), "website link" was the project (`site`) |
| WhatsApp templates | A variable value containing `{{2}}` was expanded again |
| Currency | `formatCurrency(9999999)` printed "₹100.0L"; `999999` printed "₹1000K" |
| Phone display | `+91-…` / `91…` numbers were shown unformatted |
| Lead intake | Manual leads kept hyphenated phones ("98100-01025"), so duplicates were never detected later |
| Email | Names, project names and automation messages were inserted into HTML unescaped (markup/script injection into customer email) |
| Automation | A notification body naming `{{lead_name}}` twice only replaced the first |
| Payments | Waiving an already-paid installment was allowed |
| Complaints | Reopening kept the old resolved time |
| Leave | Approving never reduced the balance; a decided request could be flipped (approve twice = double deduction); people could approve their own leave; reversed/empty dates accepted |
| Payroll | Broker logins were put on the payroll; a failed slip insert left a half-built run; invalid month/year accepted |
| Accounts | An admin could deactivate their own account (possible total lock-out) |
| Login | `_` / `%` in an email were wildcards in the lockout lookup (failures attributed to the wrong account) |
| Mobile API | Broker tokens worked; double check-in created two open rows; "today" used the UTC date instead of IST |
| Notifications | A rejected notification insert was swallowed silently (supabase-js returns errors, it does not throw) |
| WhatsApp auto-reply | Saving a rule needed only a login, and invalid JSON crashed the action |
| **PAN / Aadhaar** | Stored as **plain text** in columns named `*_encrypted`, shown in full on client and booking pages and in PDFs. Now AES-256-GCM encrypted (`PII_ENCRYPTION_KEY`, **required to save an ID**), shown masked (`••••••234F`) |

## Found, not fixed (decision or data)
- **Production URL is down:** `https://anon-crm.vercel.app` returns `DEPLOYMENT_NOT_FOUND` for every path (checked 2026-10-20). The domain is not attached to a live deployment; fix in the Vercel dashboard.
- **SLA clock** runs from lead creation, not from entering the current stage, so every "contacted" lead older than a day shows as breached (`it.todo` in `tests/unit/utils.test.ts`; needs a stage-entered-at column).
- **Lead score:** the "budget matches inventory" (+20) and "large mismatch" (−15) signals can never apply — no caller passes the project budget.
- **Score conditions in automations** never match: the context never carries `score`.
- **Payroll** gives everyone 26/26 days; attendance and approved leave do not feed loss-of-pay, and PF is 12% of basic with no statutory ceiling.
- **Deactivated staff** keep a valid session until their token expires (data access is blocked by RLS, but pages may still render).
- **Data (SQL `DATA:` checks):** 6 plots are `booked` with no booking, 3 plots are stuck on hold with no expiry, 3 approved brokers have no portal login.


---

## Added after a live UI walk-through of production (`anaon-crm.vercel.app`)

Found by signing in and using the app (with the test data you authorised; I deleted what I created).

| # | What you see in the app | Cause | Status |
|---|-------------------------|-------|--------|
| 1 | **Bookings list: "0 results"** though the stats say 3 confirmed; **opening any booking is a 404**; creating a booking lands on a 404 | Query embedded `brokers!bookings_broker_id_fkey`; the real constraint is `bookings_broker_fk`. PostgREST rejects the whole query and the code swallowed the error | Fixed in code (needs deploy) |
| 2 | **Inventory project page: "Plot Map (0 plots)"** for a project with 19 plots | `plots_booked_by_client_id_fkey` does not exist (`plots_booked_by_client_fk`) | Fixed (needs deploy) |
| 3 | **Audit Log: "0 entries"** (84 exist) and Security → "No recent security events" | `audit_logs.user_id` references `auth.users`, so the `profiles:user_id` embed was invalid | Fixed (needs deploy) |
| 4 | **Reports → Financial: "Commission Due ₹0"** | Selected `brokers.name` (column is `full_name`) and `amount` (column is `commission_amount`) | Fixed (needs deploy) |
| 5 | **Brokers: "Top Commission 1.75%"** (highest rate is 2.5%), top brokers were just the first names alphabetically | "Top" limit applied before ranking; rate taken from the top-earner | Fixed (needs deploy) |
| 6 | **Follow-ups and site visits are 5½ hours late** (set 7:56 PM, stored 19:56 UTC = 1:26 AM IST; a visit set for 11:00 AM shows 4:30 PM) | `datetime-local` values have no zone and were saved as UTC | Fixed: zone-less times are IST (`lib/datetime.ts`) (needs deploy) |
| 7 | **Times differ on the same page** ("Created 10:25 AM" vs timeline "3:56 PM"), and the console logs React hydration error #418 | Server formatted in UTC, browser in IST | Fixed: everything formats in IST (needs deploy) |
| 8 | **"Assign To" silently pre-selects the first person** (a manager) instead of "Auto (round-robin)"; same on every select with a placeholder | `Select` renders its placeholder as a *disabled* option, so the browser picks the first real option | Fixed in the component (needs deploy) |
| 9 | **Lead score drops when a lead moves forward** (15 → 10); completing a visit never rescored | Stage change selected only `stage, score` (no `created_at`/`source`), and `advanceStageForward` never rescored | Fixed (needs deploy) |
| 10 | New leads keep the number as typed (`+9198765-43210`), so duplicates are missed | Not normalised on manual create | Fixed earlier, needs deploy |
| 11 | Site Visits card says "(0)" right after scheduling until reload | Card state not refreshed after the action | Open (minor) |
| 12 | Booking numbers are random (`BK-2026-00305`, seed data is `BKG-2026-001`) | Column default uses `RANDOM()`; a collision would fail the insert | Open |
| 13 | WhatsApp templates: two named `payment_reminder`, two `site_visit_confirmation` | Name uniqueness not enforced; the duplicates can never both be submitted to WhatsApp | Open (data) |
| 14 | Marketing: headline ROAS 42x (₹1.6 Cr revenue) but ROAS by source/campaign uses only ₹19.5 L; two campaigns share `utm_campaign` `jaipur_plots_q1` so their spend/leads merge | Headline counts all revenue; campaigns attributed by utm | Open |
| 15 | Team: every member shows "At Risk" when they have no target set | No-target treated as 0% | Open |
| 16 | Active sessions list has 21 entries and grows by one per login | Sessions never expire/clean up | Open |

### New automated guards
- `tests/unit/schema-contract.test.ts` — every PostgREST relationship hint in the code must exist in the schema (fixture `tests/fixtures/db-foreign-keys.json`); `profiles:user_id` embeds are banned.
- `npm run test:db` — `select-sweep.mjs` runs all 270 `.select(...)` strings in the code against the live database (all accepted), and `write-columns-sweep.mjs` checks all 231 insert/update payloads use real columns.
