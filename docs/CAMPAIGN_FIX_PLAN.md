# Campaign Features — Fix Plan (2026-10-20)

Scope: Marketing campaigns (`/marketing`) and WhatsApp broadcast campaigns (`/whatsapp/broadcasts`).
Source: the end-to-end audit of 2026-10-20 (16 marketing + 15 broadcast findings).

**Status: implemented 2026-10-20.** Migrations `20261022100000_campaign_fixes` and
`20261022100100_campaign_resolver_private` are applied. Vitest 313/313,
`tests/sql/04_campaigns.sql` 24/24, `next build` clean. One ops step remains (bottom).

## Design decisions

1. **Spend is derived, never typed.** `marketing_campaigns.spend` = sum of `campaign_spend_logs`,
   maintained by a DB trigger (atomic, race-free). Existing hand-entered spend is preserved as one
   `kind = 'opening'` log per campaign, so the first daily log no longer wipes it.
2. **Attribution is a foreign key, resolved once.** `leads.marketing_campaign_id` is set by a DB
   trigger at insert/update time, matching in order: Meta campaign ID → `utm_campaign`
   (case/space-insensitive) → campaign name. Creating or editing a campaign re-links matching
   leads. ROI groups by the FK instead of string-joining in JS, so Meta leads that carry a
   campaign *name* still land on the right campaign.
3. **ROI is computed in SQL.** Three `security invoker` functions (RLS still applies) replace the
   JS aggregations that pulled raw rows (and were silently capped by PostgREST). One definition
   of a "site visit" (a lead with ≥1 completed visit) and of "paid" (paid platform, non-organic
   medium) is used by the headline and both tables. Spend in a date range = spend logs in range.
4. **One lead-ingest path.** The Meta webhook goes through `ingestLead` (valid enum, dedupe,
   assignment, scoring, notifications, automations) and only acknowledges events it processed;
   transient Graph API failures return 500 so Meta retries.
5. **Broadcast start is an atomic claim.** `draft|scheduled → queueing` in one `UPDATE … WHERE
   status IN (…)`; recipients are unique per `(broadcast_id, phone)`. A failed queue rolls back
   and records `last_error`.
6. **Broadcasts are driven every 5 minutes** by pg_cron + pg_net (Vercel's cron stays as a daily
   fallback) and auto-continue while the detail page is open.

## Marketing campaigns

| # | Issue | Fix |
|---|-------|-----|
| M1 | Spend log overwrote campaign spend | `kind` column + opening-balance backfill; trigger recomputes spend on log insert/update/delete; action no longer writes spend |
| M2 | Meta webhook inserted invalid `source`, bypassed ingest, lost leads on transient errors | Rewrite on `ingestLead`; `facebook_ads`/`instagram_ads` from Graph `platform`; Meta IDs stored on the lead; event marked processed only on success; 500 on transient failure; dedupe skips only processed events |
| M3 | Meta leads never matched campaigns (name vs slug, case, Meta ID unused) | `leads.meta_campaign_id`, `leads.marketing_campaign_id`, resolver + triggers, backfill; AgencyX path passes campaign name (matched by name) |
| M4 | No campaign edit | `updateCampaign` action; `CampaignForm` edit mode; Edit button |
| M5 | Spend logs invisible, duplicate dates, `reach` missing | Unique `(campaign_id, log_date)` for daily logs, upsert ("replaces that day"); history modal with delete; `reach` field |
| M6 | Visits headline counted all visits / scheduled / repeats | SQL: distinct leads with a completed visit, paid basis in headline |
| M7 | Sources shown as "Other"; `portal99acres` ≠ `99acres` | `marketing_source_key()` normaliser; label map for all sources |
| M8 | No date range; spend not date-bounded | From/To filter (GET params) wired to SQL functions |
| M9 | Silent 1000-row caps | SQL aggregation |
| M10 | Status toggle swallowed errors | Controlled select, revert + inline error |
| M11 | No page role check; dead `marketing` role; unused `updateCampaignSpend`; no end ≥ start | `notFound()` for non-managers; cleanup; DB check + action validation; case-insensitive unique `utm_campaign` and unique Meta campaign ID |

## WhatsApp broadcast campaigns

| # | Issue | Fix |
|---|-------|-----|
| B1 | Scheduled broadcasts ran once a day | pg_cron (every 5 min) → pg_net → `/api/cron/broadcasts`, reading URL + secret from Vault; only fires when work is due; page auto-continue |
| B2 | Queued count / Continue from first 500 rows | Exact count query; "showing 500 of N" |
| B3 | `whatsapp_opt_in = false` not excluded | Recorded as skipped ("has not opted in") for every template category |
| B4 | No stage filter included won/lost leads | Engine excludes `closed_won`/`not_interested` unless explicitly chosen |
| B5 | Double queue race / partial insert | Atomic claim (`queueing`), unique `(broadcast_id, phone)`, rollback on failure |
| B6 | Transient send failures permanent | Network/5xx/reconnect errors stay queued and stop the batch; "Retry failed" re-queues send-time failures (same idempotency reference) |
| B7 | Cancel didn't stop in-flight batch; stale totals | Status re-checked before every send; totals recomputed on cancel |
| B8 | Failing scheduled broadcast stuck silently | Back to `draft` with `last_error`, creator notified, error shown in UI |
| B9 | Silent 5000 / 1000 audience cap | Paged audience fetch (1000/page) up to 20,000, explicit error above |
| B10 | Form lacked source/project/budget; no preview | Fields added; live audience preview (sendable / opted-out / no opt-in / missing variables) |

## Verification
- `tsc --noEmit`, `eslint`, `vitest`.
- SQL: backfill counts, trigger behaviour (log insert/delete → spend), resolver on sample leads,
  ROI functions vs. previous numbers.
- Browser: `/marketing` (filters, edit, spend history), `/whatsapp/broadcasts/new` (preview).

## Ops step (one-time, by an admin — secret is not stored in git)
```sql
select vault.create_secret('https://dashboard.anonindia.com', 'crm_base_url');
select vault.create_secret('<CRON_SECRET from Vercel>', 'crm_cron_secret');
```
Until both exist the 5-minute job is a no-op and the daily Vercel cron remains the fallback.
