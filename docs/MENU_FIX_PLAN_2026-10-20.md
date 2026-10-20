# Fix plan for the menu audit (2026-10-20)

Source: [MENU_AUDIT_2026-10-20.md](MENU_AUDIT_2026-10-20.md). Each phase ends with `tsc`, `npm test` and
`npm run test:db`. Database changes go in `supabase/migrations/2026102300xxxx_*.sql` and are applied to
production with the Supabase MCP, then checked with a simulated user in a rolled-back transaction.

Files with uncommitted changes from the parallel Marketing/WhatsApp session (`lib/marketing/*`,
`components/marketing/*`, `lib/whatsapp/{actions,broadcast,agencyx-api}.ts`, …) are left untouched;
new WhatsApp code goes in new files.

## Phase 1 — Security (database)
| Fix | How |
|---|---|
| Advisors approving bookings / marking payments paid | `BEFORE INSERT/UPDATE` guard triggers: below manager, a booking can only be inserted as `pending_approval` and its status/approval/price fields can't change; payments can't be inserted, updated or deleted; `clients.kyc_status` can't change. The service role (crons, webhooks, portal) passes. |
| Any staff can rewrite plots | Guard trigger: below manager, only the hold columns may change, and only to hold or release your own hold. |
| Advisors deleting milestones | DELETE policy → managers; the action checks the role too. |
| Price escalations never applied | `apply_due_price_escalations()` + pg_cron job, daily at 00:05 IST. |
| Forged audit entries | `writeAuditLog` lives in a `'use server'` file, so any browser could call it. Move it to a plain module. |

## Phase 2 — Staff management
- HR edit / deactivate, Team activate / deactivate, role / branch / team changes: one server module
  (`lib/team/staff.ts`) that checks the caller (admin anywhere; manager only within their hierarchy, never
  admins, never role changes), then writes with the service role. Deactivation also bans the auth user
  (sessions end); reactivation lifts the ban. Every change is written to the audit log.
- `addJunior`: role allow-list, and a caller can't create a role above their own.
- Employee Aadhaar / PAN encrypted with `encryptPii`, shown masked.
- UI: Team member page gets "Edit role & team"; HR attendance gets "Mark attendance"; Teams tree gets "Move team" (admin).

## Phase 3 — Core flows
- Lead → client: "Convert to client" on the lead page → `/clients/new?lead_id=…`, prefilled; ClientForm sends `lead_id`;
  a duplicate conversion is refused; a timeline entry is added; the client page links back to the lead; "New booking" from the client page is prefilled.
- Bookings: the booking-amount installment is created automatically; "Send allotment letter" emails the PDF; the pending total counts `overdue` installments.
- Construction: completing a payment-trigger milestone creates the milestone installment on construction-linked bookings (due in 15 days) and notifies the managers; deleting a milestone needs a manager.
- Attendance: the mobile API and the mobile admin page use `attendance_logs` (one table).
- Complaints queue `/clients/complaints` (list, filter, assign, status).
- Loans: an editor for the document checklist and notes; the client page lists loans.

## Phase 4 — Reports & audit
- Lead Funnel / Lead Ageing stage lists match `lead_stage`.
- `fetchAll()` helper reads in pages of 1,000 rows, so reports don't stop at 1,000; the SLA `in()` filter is chunked.
- Source performance applies the date range to visits and bookings.
- Audit log: booking approve / reject / cancel, payment record / waive / delete, installment add, plot price change,
  commission approve / pay, client KYC / PII changes, staff changes.

## Phase 5 — Leads UX
- Filter bar: source, advisor, project. Table / Kanban toggle keeps filters.
- Bulk actions report the result; bulk Not Interested asks for a loss reason; bulk Closed Won is refused (use a booking); re-scoring runs in parallel batches.
- Merge also moves albums, hold log and broadcast recipients.
- `<Link><Button>` nesting removed.

## Phase 6 — Files, legal, security settings, HR
- Uploads: private `crm-files` bucket, upload server action, `/api/files/…` route (staff only, plus the client's own files for portal sessions) that redirects to a short-lived signed URL. A `FileUrlInput` (paste a link or upload) replaces the bare URL inputs for client documents, project documents, agreement, construction photos and legal templates.
- Consent: lead capture from website/form sources records `data_processing` consent when the form says it collected it; WhatsApp STOP / START records marketing consent withdrawn / given; the CRM lead form gets a consent checkbox.
- Legal templates editable.
- Security: Unlock account button; session timeout enforced in the proxy (idle cookie); the IP allowlist can't be enabled unless the admin's current IP is active on it; IP format validated; errors surfaced.
- HR: leave entitlement editor; payroll slip adjust (draft runs only).
- Inventory: premium matrix editor, plot hold history, "My holds".
- WhatsApp: attach and send media from the inbox (new `lib/whatsapp/media-actions.ts`).
- Page gates: HR, Legal, Automation, Brokers, Mobile, financial reports redirect non-managers. Dashboard module grid follows the role; "Pending Approval" opens the filtered list.

## Not changing (decisions, not defects)
- The IP allowlist can't cover direct Supabase API calls; that needs Supabase network restrictions.
- Commission maker/checker: left as is for a small team (one person may approve and pay); noted.
- Marketing: owned by the parallel session.
