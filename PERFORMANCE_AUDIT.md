# ANON INDIA CRM — Performance Audit

**Scope:** `crm/` only (Next.js 16 App Router · React 19 · Tailwind 4 · Supabase Postgres).
**Date:** 2026-06-12

---

## ✅ Fixes applied (2026-06-12)

Supabase performance advisories: **381 → 211**. All WARN-level perf issues eliminated or cut 60%.

| Advisory | Before | After |
|---|---|---|
| `auth_rls_initplan` (WARN) | 74 | **0** |
| `unindexed_foreign_keys` (INFO) | 93 | **0** |
| `duplicate_index` (WARN) | 2 | **0** |
| `multiple_permissive_policies` (WARN) | 153 | **61** |
| `unused_index` (INFO) | 59 | 150¹ |

¹ Rose because the 93 newly-created FK indexes are not yet exercised by dev traffic — they are correct and will be used in production. This is exactly why "unused" indexes must **not** be dropped in dev.

| Fix | What was done | Verified |
|---|---|---|
| **FK indexes** | `perf_add_missing_fk_indexes` — covering indexes for all **93** unindexed FKs | `fks_still_unindexed = 0` |
| **Duplicate indexes** | `perf_drop_duplicate_indexes` — dropped `idx_bookings_project_id`, `idx_payments_booking_id` | `dup_indexes_remaining = 0` |
| **RLS initplan** | `perf_rls_initplan_wrap_auth_calls` — wrapped `auth.*()` in `(select …)` across **74** policies via `ALTER POLICY` | `truly_unwrapped = 0` |
| **Permissive policies + security** | `perf_sec_restrict_public_policies_to_authenticated` — restricted **62** `public`-role policies to `authenticated` (kept 7 genuine marketing reads). Also **closed anon read/write holes** on `security_settings`, `user_sessions`, `ip_whitelist`, `assignment_rules`, `property_albums`, `incentive_slabs`, `album_views` | policies: 159 authenticated / 7 public / 7 anon / 2 service_role |
| **Loading skeletons** | Shared `PageSkeleton` + `loading.tsx` on **16** module routes | `tsc --noEmit` clean |

**Intentionally NOT applied (would cause harm or need redesign):**
- **`unused_index` drops** — false positives in dev (see ¹). Re-run the advisor after real production traffic before considering any drop.
- **Remaining 61 `multiple_permissive`** — same-role `SELECT` + `ALL` overlaps (team-read + admin-write). Collapsing changes per-table access logic; needs deliberate security review, not a mechanical pass.
- **`getClients` → `count:'estimated'`** — the `total` drives the pagination UI ("Page X of Y", "N total clients"); an estimate would display wrong numbers. Kept `exact`.
- **`<img>` → `next/image`** — most sources are signed Supabase Storage URLs (query-string tokens) that the image optimizer mishandles, and Next 16's image API differs from older docs (per `AGENTS.md`). Worth doing as a careful, verified pass — not a blind bulk edit.
- **Trimming `force-dynamic`** — a no-op here: these pages call `cookies()`/auth via `getProfile`, which already opts them out of static caching. Removing the flag changes nothing.

---

## Executive summary

The frontend architecture is genuinely good — server components by default (only 4 of 101 pages are `'use client'`), `react/cache` on the Supabase client and `getProfile`, parallelized page queries with `Promise.all`, `modularizeImports` for `lucide-react`, and `compress`/`poweredByHeader` already tuned in `next.config.ts`.

**The real performance problem is in the database, not the React code.** Supabase's own performance advisor flags **381 issues**, and the top three categories will degrade every page in the app as data grows. Fixing the database is ~80% of the available win and is pure SQL — no app refactor needed.

| Priority | Area | Issue | Impact |
|---|---|---|---|
| 🔴 P0 | Postgres RLS | 74 policies re-evaluate `auth.uid()` per row | Every list query slows linearly with row count |
| 🔴 P0 | Postgres RLS | 153 "multiple permissive policies" warnings | Each duplicate policy runs on every query |
| 🟠 P1 | Postgres indexes | 93 foreign keys with no covering index | Slow joins/filters on `leads`, `bookings`, `payments`… |
| 🟠 P1 | Next.js caching | 82 of 101 pages are `force-dynamic`, 3 `loading.tsx` | No caching, blank waits on navigation |
| 🟡 P2 | App queries | `select('*')` (47×) + `count: 'exact'` on lists | Over-fetching columns + full count scans |
| 🟢 P3 | Cleanup | 59 unused indexes, 2 duplicate indexes | Wasted write overhead & storage |

---

## 🔴 P0 — Database RLS is the dominant cost

### 1. `auth_rls_initplan` — 74 policies, 36 tables

RLS policies call `auth.uid()` / `current_setting()` **directly**, so Postgres re-evaluates them **once per row** instead of once per query. On a `leads` table of 50k rows this turns an indexed lookup into a 50k-iteration function call. This is the single biggest scalability risk in the app.

Worst-hit tables: `announcements`, `broker_commissions`, `brokers`, `attendance` (4 each), then `profiles`, `team_targets`, `plots`, `leads`, `bookings`, `payments`, `clients`.

**Fix** — wrap the auth call in a scalar subselect so Postgres evaluates it once (an `initplan`):

```sql
-- Before
USING ( assigned_to = auth.uid() )
-- After
USING ( assigned_to = (select auth.uid()) )
```

Apply this pattern to all 74 flagged policies. Pure find-and-replace, zero behavior change. Docs: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

### 2. `multiple_permissive_policies` — 153 warnings

Many tables have **multiple permissive policies for the same role + action** (e.g. `assignment_rules` has both `*_read_authenticated` and `*_write_authenticated` permissive for `anon`/`SELECT`). Postgres must run **every** permissive policy on every query and OR the results.

Two things are happening:
- **Policies are granted to `anon`** when they should target `authenticated`. The CRM has no anonymous traffic — every `anon` policy is dead weight executed on each query.
- **Read and write policies overlap** on the same action.

**Fix:** consolidate to one policy per (role, action), and scope to `authenticated` (or `TO authenticated`) instead of the default `public`/`anon`. This also tightens security.

> These two RLS fixes compound: every list endpoint (`getLeads`, `getClients`, `getBookings`, reports RPCs) benefits on every request.

---

## 🟠 P1 — Missing indexes & no caching

### 3. `unindexed_foreign_keys` — 93 FKs, 50 tables

Foreign-key columns without a covering index force sequential scans on joins and on cascade checks. Most exposed in hot paths:

- `bookings` (5 FKs), `leads` (5), `client_documents` (4), `projects` (4)
- `broker_commissions`, `complaints`, `construction_milestones`, `loan_applications`, `site_visits`, `payment_extension_requests` (3 each)

These are exactly the columns the app filters/joins on — e.g. `leads.project_id`, `leads.assigned_to`, `bookings.client_id`, `payments.booking_id`.

**Fix:**
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_project_id   ON public.leads(project_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_assigned_to  ON public.leads(assigned_to);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_client_id ON public.bookings(client_id);
-- …one per flagged FK (the advisor lists each by name)
```
Run the full list from `get_advisors(performance)`. Use `CONCURRENTLY` so it doesn't lock writes.

### 4. Almost everything is `force-dynamic`, almost nothing streams

- **82 of 101 pages** export `dynamic = 'force-dynamic'` → no static/ISR caching, every navigation is a fresh server round-trip + DB hit.
- Only **3 `loading.tsx`** files exist (`leads`, `bookings`, `dashboard`). The other ~98 routes show a **blank screen** during the server fetch instead of an instant skeleton.

**Fix:**
- Add `loading.tsx` skeletons to every list/detail route. This is the cheapest perceived-performance win in the app — navigation feels instant even when the query is slow.
- Audit whether each `force-dynamic` is truly needed. Pages keyed only on `searchParams` are already dynamic without the flag; reference data (projects, banks, DSAs, branches, advisors list) can use `revalidate`/`unstable_cache` instead of refetching every render. Today only **3 files use `revalidate`** and **1 uses `unstable_cache`**.
- `getActiveAdvisors`, project lists, and similar lookups are read on many pages and rarely change — strong candidates for cached fetches.

---

## 🟡 P2 — Application query hygiene

### 5. `select('*')` on list queries (47 occurrences)

`getLeads` selects `*` plus two joined relations and returns up to 200 rows; `getClients`, `getBookings`, `getInventory`, etc. do the same. List views render a fixed set of columns — fetching every column (including large text/JSON fields) inflates payload and DB I/O.

**Fix:** select only the columns the table/card renders. Keep `*` for single-record detail pages where the full row is genuinely used.

### 6. `count: 'exact'` on paginated lists

`getClients` uses `.select('*', { count: 'exact' })`. An exact count makes Postgres scan all matching rows on every page load. On large tables use `{ count: 'estimated' }` (or `'planned'`), or drop the count and switch to cursor pagination.

### 7. `getClients` project filter does a JS round-trip

The `project_id` filter fetches all `bookings.client_id` into Node, dedupes in JS, then issues a second `.in(...)` query. Replace with a single SQL `IN (subquery)` / join or an RPC — removes a network hop and an unbounded array.

### 8. Raw `<img>` instead of `next/image` (12 components)

`ClientCard`, `MemberCard`, `TeamTree`, `ProjectCard`, employee/team/client photos, etc. use `<img>`. Only **1** file uses `next/image`. You lose automatic resizing, lazy-loading, and modern formats — avatar/photo grids ship full-resolution originals. Migrate user/project photos to `next/image` (add the Supabase storage domain to `images.remotePatterns`).

---

## 🟢 P3 — Cheap cleanups

- **59 unused indexes** — never used by the planner; each one slows every `INSERT`/`UPDATE` and wastes storage. Verify against expected query patterns, then `DROP INDEX CONCURRENTLY`.
- **2 duplicate indexes** — `bookings` has identical `idx_bookings_project` + `idx_bookings_project_id`; drop one of each pair.
- `.next` build dir is **3.9 GB** locally — not a runtime issue, but confirm `.next/`, `node_modules/`, `tsconfig.tsbuildinfo` are gitignored and excluded from deploy uploads.

---

## Recommended order of execution

1. **RLS `(select auth.uid())` rewrite** (P0 #1) — highest impact, mechanical, no behavior change.
2. **Consolidate permissive policies + drop `anon` grants** (P0 #2) — perf + security.
3. **Add the 93 FK indexes** (P1 #3) — `CREATE INDEX CONCURRENTLY`.
4. **Add `loading.tsx` skeletons everywhere** (P1 #4) — biggest *perceived* speedup.
5. **Cache reference-data fetches; trim unnecessary `force-dynamic`** (P1 #4).
6. **Narrow `select('*')` + `count: 'estimated'` on list queries** (P2).
7. **Drop 59 unused + 2 duplicate indexes; migrate `<img>` → `next/image`** (P2/P3).

Steps 1–3 are SQL-only and deliver most of the win. The full per-object lists (every policy, FK, and index by name) are available from the Supabase performance advisor — run `get_advisors(type: performance)` to generate the exact migration.

---

### What's already good (don't touch)
- Server-components-first; client JS is minimal (4 client pages).
- `react/cache` on `createClient` + `getProfile` → no duplicate auth/profile queries per request.
- Page-level `Promise.all` parallelization; stats via Postgres RPCs (`get_lead_stats`, `get_exec_dashboard`) instead of N+1.
- `modularizeImports` tree-shakes `lucide-react`; `compress` + `poweredByHeader:false` set.
- `getLeads` is correctly capped at `.limit(200)`.
