# ANON INDIA CRM — Performance Plan

**Date:** 2026-06-18
**Method:** Live Supabase performance advisors (212 lints) + codebase scan of hot paths.
**Baseline (already good):** `getProfile()` is `cache()`-deduped; dashboard/leads/reports pages fan out queries with `Promise.all`; exec dashboard is a single RPC. Gaps are concentrated, not systemic.

---

## Findings & status

| # | Issue | Evidence | Severity | Status |
|---|-------|----------|----------|--------|
| 1 | Leads list over-fetches + no pagination | `getLeads` `select('*')` (46 cols) + `.limit(200)`, no `range`/`count` | 🔴 High | **FIXED** (pagination) |
| 2 | `push_tokens` RLS re-evals `auth.uid()` per row | 3 `auth_rls_initplan` WARN lints | 🔴 High | **FIXED** |
| 3 | 61 `multiple_permissive_policies` on hot tables | leads/clients/payments/bookings/brokers/complaints | 🟠 Med | **Deferred** (see §Deferred) |
| 4 | 49 `select('*')` across list queries | grep | 🟠 Med | Partial (leads pagination caps rows) |
| 5 | 12 raw `<img>`, 0 `next/image` | grep | 🟠 Med | **FIXED** (ProjectCard + share + config) |
| 6 | Follow-up cron N+1 (per-lead last activity) | `followup-reminders/route.ts` loop | 🟠 Med | **FIXED** (batched) |
| 7 | 82 `force-dynamic` (no caching) | grep | 🟠 Med | **Deferred** (pages read auth cookies → dynamic is correct; cache the aggregate *queries* instead) |
| 8 | 148 unused indexes | advisor lints | 🟡 Low | **Deferred** (need real traffic) |
| 9 | `next.config` icon shim / no image formats | next.config | 🟡 Low | **FIXED** |

---

## Fixes applied (this pass)

1. **`push_tokens` RLS initplan** — migration wraps `auth.uid()` → `(select auth.uid())` for the 3 own-row policies. Evaluated once per query instead of per row.
2. **Leads pagination** — `getLeads` refactored around a shared `applyLeadScope()` builder; new `getLeadsPage(filters, page, pageSize)` returns `{ leads, count }` via `.range()` + a head `count`. Table view paginates (50/page) with a `Pagination` control; Kanban + overdue keep the prior capped behaviour (no regression).
3. **`next/image`** — converted `ProjectCard` and the public `/share` page; added `images.formats` (AVIF/WebP) + `remotePatterns` to `next.config`.
4. **Follow-up cron N+1** — one batched `lead_activities` fetch for all due leads, mapped in memory, instead of one query per lead.
5. **`next.config`** — `experimental.optimizePackageImports: ['lucide-react','date-fns']` (Next 16 native) replacing the manual `modularizeImports` shim; `images.formats` + Supabase `remotePatterns`.

## Deferred (risk-managed, separate pass)

- **RLS policy consolidation (#3)** — combining the 61 multiple-permissive policies changes *security-relevant* logic; needs a per-table audit + access tests before applying. Highest-value DB perf item after this pass.
- **Index pruning (#8)** — 148 "unused" indexes are partly unused because the DB has little data yet. Drop only after observing production query patterns, or several will be recreated.
- **Broader `select('*')` trims (#4)** — column-level trimming risks omitting fields the UI reads; do per-query with UI verification.
- **Reports caching (#7)** — the `/reports/*` pages read auth cookies (Supabase server client), so Next renders them dynamically regardless of `revalidate`. The real win is wrapping the org-wide aggregate queries in `unstable_cache` (tag + TTL, invalidated on write) — a focused, staleness-aware change.
