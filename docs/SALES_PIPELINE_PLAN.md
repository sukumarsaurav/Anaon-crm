# Sales Pipeline — Execution Plan

Implementation plan for [SALES_PIPELINE_FEATURES.md](SALES_PIPELINE_FEATURES.md). Grounded in the current codebase (`crm/src`). Ordered by leverage — each phase ships something usable on its own.

---

## ✅ Shipped (Phases 0, 1, 2, 3, 4, 6, 7, 8 + multi-app architecture)

**Phase 8 — Shareable property albums + view analytics**
- `property_albums` + `album_views` tables; `record_album_view()` SECURITY DEFINER fn (atomic counter + log).
- Public branded page `/share/[token]` (no auth — in `proxy.ts` allowlist) reusing project gallery/amenities/layout/RERA + selected plots, with call/WhatsApp CTA to the rep. Inactive/missing tokens 404.
- CRM `/albums` page: create albums (per project, personalized), copy/open share link, enable/disable, and **view counts**. Sidebar link under Property. *Verified: public render 200, view tracked (count+rows+timestamp), inactive→404.*


**Architecture** — Two-app split documented in [DEPLOYMENT.md](DEPLOYMENT.md): `website/` → apex domain, `crm/` → `dashboard.domain.com` (CRM is the admin). Website nav has an "Agent Login" link (`NEXT_PUBLIC_DASHBOARD_URL`); CRM uses `NEXT_PUBLIC_APP_URL`. Vercel Cron (`crm/vercel.json`) schedules all three `/api/cron/*` jobs — resolves the earlier scheduler gap.

**Phase 6 — Site-visit lifecycle**
- `scheduleSiteVisit` + `recordSiteVisitOutcome` server actions (`lib/leads/siteVisits.ts`): pre-visit details, forward-only stage advance, next-followup wiring, automation events.
- `SiteVisitsCard` on lead detail — schedule + record-outcome (feedback + auto follow-up) modals.
- Day-of reminder cron `/api/cron/site-visit-reminders` (IST-aware, idempotent via `site_visits.reminded_at`). *Verified: notified 1 → 0; notification created.*

Built and verified end-to-end against the live Supabase project + a production build.

**Phase 0 — Stage alignment**
- `token_paid` stage added to `lead_stage` enum, types, Kanban board, badges, scoring (+10).
- `loss_reason` column added to `leads` for future win/loss reporting.

**Phase 1 — Follow-up reminder loop**
- Cron `POST /api/cron/followup-reminders` (Bearer `CRON_SECRET`): finds due/overdue follow-ups on active, open, assigned leads and notifies the rep with last-note context. Idempotent via `leads.followup_reminder_sent_at` (reset whenever a new follow-up is scheduled). *Verified: 1st run notified 24 reps, 2nd run notified 0.*
- Overdue manager view at `/leads/overdue` (admin/manager only) — days overdue, rep, tap-to-call/WhatsApp, one-click reassign. Linked from the Leads header.

**Phase 2 — Lead capture connectors**
- Shared normalizer `lib/leads/ingest.ts`: phone-dedupe, round-robin assignment, scoring, activity log, `fireAutomations('lead_created')`.
- Generic webhook `POST /api/webhooks/leads/[source]?token=<LEAD_WEBHOOK_SECRET>` for 99acres, MagicBricks, Housing, JustDial, IndiaMart, LinkedIn, Google Lead Form, website. *Verified: new lead, duplicate, 401/404/422 paths.*
- `lead_source` enum + labels extended for the new sources.
- Admin integrations page at `/settings/integrations` with copy-paste webhook URLs.

**Phase 4 — Smart lists**
- New view presets on `/leads`: Hot Leads, Follow-up Today, Overdue, Site Visits This Week, Ready to Buy, Future Buyers, New Today.

**Phase 3 — Auto-assignment rules engine**
- `assignment_rules` table (priority-ordered; conditions on source / property type / city / budget; target = specific advisor or round-robin pool).
- Shared resolver `lib/leads/assignment.ts` `resolveAssignee()` — first matching rule wins, else global round-robin. Wired into both `createLead` (server) and `ingestLead` (webhook). Replaces the old round-robin-only path.
- Admin rules UI at `/settings/assignment`; new `/settings` hub page (sidebar now points to `/settings`). *Verified: Jaipur+99acres lead → Priya; non-matching city/source → round-robin.*

**Phase 7 — Pipeline reporting & analytics**
- New report page `/reports/pipeline`: source conversion %, first-response-time by rep, win-rate, and win/loss reason breakdown. Linked from `/reports`.
- New queries in `lib/reports/queries.ts`: `getWinLossReport`, `getResponseTimeByRep`, `conversionRate` added to `getSourcePerformance`.
- Loss-reason capture: `LossReasonModal` on "Mark Not Interested" (lead detail); `changeLeadStage` now persists `leads.loss_reason`. *Verified: response-time aggregation matches DB; build passes.*

### ⚠️ One deployment step required
The reminder cron (and the existing automations cron) need an **external scheduler** to POST on an interval — `pg_cron` is not enabled on this project. Add a scheduler (Vercel Cron, GitHub Action, or enable `pg_cron` + `pg_net`) to hit:
`POST /api/cron/followup-reminders` every ~15 min with header `Authorization: Bearer $CRON_SECRET`.
Also set `CRON_SECRET` and `LEAD_WEBHOOK_SECRET` in the deployment env (defaults are in `.env.local` for dev only).

---

**Current foundation (already built):** Kanban + drag-drop, 0–100 scoring + temperature, duplicate detection, activity timeline, bulk actions, round-robin assignment, Meta lead webhook, `fireAutomations()` engine, `notifications` table, mobile app shell, `next_followup_at` + `scheduleFollowUp()` + `logFollowUp()` with outcomes.

---

## Phase 0 — Stage alignment & data model (½ day)

Foundation the rest depends on. Small, do first.

- [ ] Add `token_paid` to `LeadStage` in `types/leads.ts` and the DB stage enum/check constraint (migration). Final order: `new_lead → contacted → interested → site_visit_scheduled → site_visit_done → negotiation → token_paid → closed_won`, plus `not_interested` / `future_followup`.
- [ ] Confirm Kanban column config (`LeadsKanban.tsx`) renders the new stage and badge color (`StageBadge.tsx`).
- [ ] Add `loss_reason` column to `leads` (nullable text/enum) for win/loss reporting later.

**Acceptance:** lead can be dragged into Token Paid; stage persists; no type errors.

---

## Phase 1 — Follow-up reminder loop ⭐ (2–3 days)

The product's core promise: *no lead silently abandoned.* Pieces exist but aren't connected end-to-end.

- [ ] **Reminder cron** — Supabase edge function (or `app/api/cron/followup-reminders`) runs every ~15 min: finds leads where `next_followup_at <= now()` and stage not in (`closed_won`,`not_interested`), inserts a `notifications` row for `assigned_to` with lead name + number + last note + `action_url` to the lead.
- [ ] **Push delivery** — wire the notification to the mobile push channel (notifications table + `action_url` already exist; connect to Expo push tokens).
- [ ] **Overdue manager view** — new page `app/(dashboard)/leads/overdue` (or a smart-list tab): leads with `next_followup_at` in the past and no logged follow-up since. Columns: lead, rep, days overdue, last note. Actions: reassign, nudge rep.
- [ ] **No-idle-lead guard** — soft rule + UI badge: any open lead with no `next_followup_at` shows an "Needs follow-up" flag (reuse SLA `at_risk`/`breached` from `SlaStatus`).
- [ ] **Reminder-fired notification deep link** — tapping opens lead with one-tap call/WhatsApp visible.

**Acceptance:** overdue follow-up generates a push within 15 min; manager sees it in the overdue list; tapping the notification opens the lead.

---

## Phase 2 — Lead capture connectors (3–4 days)

Generalize the existing Meta webhook into a multi-source ingestion layer.

- [ ] **Generic inbound webhook** — `app/api/webhooks/leads/[source]/route.ts` with shared normalizer → de-dupe (pg_trgm) → insert → auto-assign → `fireAutomations('lead_created')`. Refactor `meta-leads` to use it.
- [ ] **Source connectors** (each maps payload → normalized lead, source-tagged): 99acres / MagicBricks, JustDial, IndiaMart, Google Lead Form / Google Ads, LinkedIn, WhatsApp inbound (link to existing WhatsApp module + conversation history).
- [ ] **Source enum** — extend `LeadSource` (`99acres`, `magicbricks`, `justdial`, `indiamart`, `linkedin`, `google_lead_form`) and `platformToSource` mapping.
- [ ] **CSV/Excel import** — confirm/finish bulk upload UI with column mapping + dedupe preview.
- [ ] **Per-source config UI** — `settings/integrations` page to paste webhook URLs / API keys per portal.

**Acceptance:** posting a sample 99acres/JustDial payload creates a source-tagged, auto-assigned lead visible in the pipeline.

---

## Phase 3 — Auto-assignment rules engine (2–3 days)

Replace round-robin-only with configurable rules.

- [ ] **`assignment_rules` table** — priority-ordered rules with conditions (area, property_type, budget_band, source) → target (rep, team, or round-robin pool).
- [ ] **Resolver** — extend `getRoundRobinAdvisor` into `resolveAssignee(lead)` that evaluates rules in priority order, falls back to round-robin, respects rep availability/active status.
- [ ] **Budget bands** — derive from lead budget field (`<50L`, `50L–1Cr`, `1Cr+`).
- [ ] **Rules admin UI** — `settings/assignment` drag-to-reorder rule builder.

**Acceptance:** a Jaipur + Villa + 1Cr+ lead routes to the configured rep; unmatched leads fall back to round-robin.

---

## Phase 4 — Smart lists & pipeline polish (1–2 days)

- [ ] **Pre-built smart lists** as filter presets / tabs: Hot Leads, Site Visits This Week, Need Follow-up Today, Ready to Buy (Token Paid / Negotiation), Future Buyers (`future_followup`). Build on existing `LeadFilters.tsx` + `queries.ts`.
- [ ] **Per-stage counts + live pipeline value** on the Kanban header.

**Acceptance:** each smart list returns the correct cohort; counts match the board.

---

## Phase 5 — Mobile call & communication (3–4 days)

- [ ] **Tap-to-call** from lead screen (native dialer intent).
- [ ] **Automatic call logging** — capture time + duration on return from call, insert `lead_activities` (type `call`), prompt for note + next follow-up inline.
- [ ] **One-tap WhatsApp** from lead screen (deep link to existing WhatsApp module).
- [ ] **Call recording + volume tracking** (Android first; respect consent/compliance).
- [ ] **WhatsApp automation campaigns** — templates: welcome, monthly market update, festival greeting, new-property recommendation, buyer education, success story. Trigger via `fireAutomations` + automation builder.

**Acceptance:** rep taps to call → call auto-logs with duration → prompted to set next follow-up in one screen.

---

## Phase 6 — Site visit lifecycle (2 days)

- [ ] Link existing `site_visits` + mobile GPS check-in to the visit record.
- [ ] Pre-visit details auto-sent to client (location, project info).
- [ ] Day-of reminder with live location (reuse Phase 1 reminder infra).
- [ ] Post-visit feedback capture → auto follow-up + property suggestions.

**Acceptance:** scheduling a visit triggers pre-visit message, day-of reminder, and a post-visit feedback task.

---

## Phase 7 — Reporting & analytics (2–3 days)

Extend `reports/sales` and `reports/leads`.

- [ ] Source breakdown + conversion-by-source.
- [ ] Conversion by rep + performance rankings.
- [ ] Average response time per rep (first-touch latency).
- [ ] Live pipeline status by stage + pipeline value.
- [ ] Win/loss reasons (uses `loss_reason` from Phase 0).
- [ ] Monthly / weekly breakdowns + property popularity metrics.

**Acceptance:** manager dashboard shows source conversion, rep rankings, avg response time, and win/loss reasons with date filters.

---

## Phase 8 — Property portfolio & team (2–3 days)

- [ ] Shareable property albums (photos, floor plans, maps, BHK, price, payment plan, move-in, branding) + view analytics.
- [ ] Team: monthly targets, area assignments, commission calc, daily scorecards / rankings.

---

## Sequencing summary

| Phase | Theme | Est. | Depends on |
|---|---|---|---|
| 0 | Stage alignment | ½ d | — |
| 1 | ⭐ Follow-up loop | 2–3 d | 0 |
| 2 | Capture connectors | 3–4 d | 0 |
| 3 | Assignment rules | 2–3 d | 2 |
| 4 | Smart lists | 1–2 d | 0 |
| 5 | Mobile call/comms | 3–4 d | 1 |
| 6 | Site visits | 2 d | 1 |
| 7 | Reporting | 2–3 d | 0,2,3 |
| 8 | Portfolio & team | 2–3 d | — |

**Recommended MVP slice:** Phases 0 → 1 → 2 → 4. That delivers the full "lead in from any source → auto-assigned → never abandoned → manager sees everything" story, which is 3Sigma's entire pitch.

---

## Cross-cutting

- **Migrations** via Supabase MCP (`apply_migration`); keep RLS on every new table.
- **Automations** — prefer emitting events through existing `fireAutomations()` rather than hardcoding side effects.
- **Mobile** changes live in `/mobile`; CRM APIs under `app/api/mobile/*`.
- **Testing** each phase: post a sample payload / drag a lead / let a follow-up go overdue, and verify the observable outcome in the acceptance criteria.
