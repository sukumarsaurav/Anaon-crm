# CRM UI/UX and Performance Audit (2026-10-20, round 3)

**Scope:** `crm/` staff app, broker portal and app shell. Production `https://anaon-crm.vercel.app`, signed in as admin.
**Method:**
- Code review of the app shell, leads, lead detail, dashboard, WhatsApp inbox and portals.
- `next build` chunk analysis.
- Supabase performance advisors.
- Live timing of 25 production routes (two fetches each, warm).
- 375px phone-width layout checks on 11 routes.

**Baseline:** UI/UX fix plans 1 and 2 and the earlier performance passes are already in. This report covers only what is still wrong.

## Status
**Batch 1 done (2026-10-20, not yet deployed):** #1, #4, #7, #10, #12, #16.
- **#4:** `waLink()` in `lib/utils.ts`, with tests. It is used in lead detail, the leads table, overdue and kanban views, and the client-portal support page, which had the same bug.
- **#7:** went further than the header fix:
  - `PageHeader` actions now wrap.
  - Module tab strips scroll (loans, team, automation, legal, reports, WhatsApp).
  - The settings grid can shrink.
  - The report date-range filter fits a phone.
  - The leads table had a hidden cause: an absolutely positioned `sr-only` header label escaped the table's scroll box and widened the page to 497px. The `LeadsTable` and `DataTable` wrappers are now `relative` to contain it.
  - Re-measured at 375px with the same classes applied to the live pages: /leads 591→370, /team 434→370, /reports/* 507→370, /settings 502→375.
- **#10:** the dashboard date also moved to IST.
- **#1:** deployed in `506408f`. `x-vercel-id` is now `bom1::bom1`, and warm TTFB dropped from 0.5–1.1 s to 0.13–0.2 s.

**Batch 2 done (2026-10-20):** #5, #6, #8, #9, #11, #17.
- **#5:**
  - New helpers in `lib/datetime.ts`: `todayIST`, `istDayStart`, `istDayBounds`, `istWeekStart`.
  - 33 files moved off UTC "today".
  - `timeZone: 'Asia/Kolkata'` added to 14 date/time displays, including the site-visit reminder text, which printed the visit time in UTC.
  - The daily lead trend is now bucketed by IST date.
  - `npm run lint:ui` now also scans `.ts` and bans both patterns. Scanning `.ts` also surfaced 14 leftover `gray-*` badge colours in `src/types`, now `slate-*`.
- **#6:**
  - `lib/supabase/search.ts` `searchOr()` double-quotes values (checked against live PostgREST: the old form returned `PGRST100`) and matches phones on digits. Used by leads, brokers, the mobile leads API and ⌘K.
  - `sort_by` is allow-listed.
  - Found and fixed while doing this:
    - The sort dropdown made two navigations and dropped `sort_by`, so "Highest Score" never sorted by score.
    - Search navigated on every keystroke; it is now debounced and uses `router.replace`.
    - Changing a filter now resets `page`.
  - The `view=overdue` list now excludes closed-won and not-interested leads, like the dashboard count. It was 27 vs 26.
- **#8:** lead detail runs in one query wave.
- **#9:** the list select has 17 columns instead of 47.
- **#11:** the manager-only dashboard queries are skipped for other roles.
- **#17:** ⌘K ignores stale responses and shows an error state.
- **Correction to #15:** kanban cards already have a stage menu. Only drag-and-drop is missing.

## Summary

| # | Sev | Area | Issue | Effort |
|---|-----|------|-------|--------|
| 1 | 🔴 P0 | Perf | Functions run in Washington (`iad1`), database is in Mumbai | 1 line |
| 2 | 🔴 P0 | UX/mobile | WhatsApp inbox can't be used on a phone | ~0.5 d |
| 3 | 🔴 P0 | UX/mobile | Broker portal has no mobile layout | ~0.5 d |
| 4 | 🔴 P0 | Bug | Lead "WhatsApp" button opens the wrong number | 15 min |
| 5 | 🟠 P1 | Bug | Server-rendered times shown in UTC; "today" is UTC | ~2 h |
| 6 | 🟠 P1 | Bug | Search breaks on commas/brackets; `sort_by` not validated | ~1 h |
| 7 | 🟠 P1 | UX/mobile | Page headers don't wrap, so 5 pages render zoomed out on phones | 15 min |
| 8 | 🟠 P1 | Perf | Lead detail makes 3 sequential round-trips | 15 min |
| 9 | 🟠 P1 | Perf | Leads page sends `select *` rows to the client (277 KB HTML for 33 leads) | ~1 h |
| 10 | 🟠 P1 | UX | Dashboard cards link to an unfiltered list; greeting always says "Good morning" | 15 min |
| 11 | 🟡 P2 | Perf | Dashboard runs manager-only queries for every role | 10 min |
| 12 | 🟡 P2 | Perf | Hindi font (4 weights) preloaded on every page and unused | 5 min |
| 13 | 🟡 P2 | UX | Every tab is titled "ANON INDIA CRM" (1 of 99 pages sets metadata) | ~1 h |
| 14 | 🟡 P2 | UX | Inbox: search only covers the loaded 100 chats; forced scroll-to-bottom; `100vh` | ~2 h |
| 15 | 🟡 P2 | UX | Kanban has no drag-and-drop and silently caps at 200 leads | ~1 d |
| 16 | 🟡 P2 | UX | Settings still advertises two-factor authentication, which was removed | 5 min |
| 17 | 🟡 P2 | UX | ⌘K palette: out-of-order results, no error state | 30 min |
| 18 | ⚪ P3 | Various | Notification badge, destructive button placement, empty cards, DB advisors | — |

---

## Measured baseline (production, warm, 2026-10-20 ~17:30 IST)

| Route | TTFB | Total | HTML |
|---|---|---|---|
| /dashboard | 532 ms | 1.2 s | 81 KB |
| /leads | 1093 ms | 1.5 s | **277 KB** |
| /leads/[id] | 520–984 ms | 1.5–1.6 s | 81–98 KB |
| /whatsapp/inbox | 1107 ms | 1.3 s | 52 KB |
| /reports, /reports/sales, /pipeline | ~950 ms | 1.2–1.4 s | 70–88 KB |
| /inventory | 488 ms | 1.4–1.7 s | 182 KB |
| /marketing | 506 ms | 1.9 s | 116 KB |
| /login (cold) | 1973 ms | LCP 6.4 s | 11 KB |

- **Client JS:** about 110–120 KB gzip per dashboard route, plus React. The largest shared chunk is `supabase-js` at about 62 KB gzip. The shell loads it for the badge, notification and search widgets.
- **Supabase perf advisors:** 26 `multiple_permissive_policies` (WARN) and 102 `unused_index` (INFO; ignore until there is real traffic).

---

## 🔴 P0

### 1. Serverless functions run on the other side of the world from the database
`x-vercel-id: bom1::iad1::…`: the request reaches the Mumbai edge, then the page renders in **iad1 (Washington DC)**. Supabase is in **ap-south-1 (Mumbai)**, so every query and every `getClaims` JWKS fetch crosses the Pacific, at roughly 200 ms per round-trip. This explains the 0.5–1.1 s TTFB on pages with very little data, and most of the 2 s cold login.
**Fix:** add `"regions": ["bom1"]` to [vercel.json](../vercel.json) (or set it in the project's Function Region setting) and redeploy. Expect TTFB to drop by several hundred ms on every page. Every other fix in this report gains less than this one.

### 2. WhatsApp inbox can't be used on a phone
[InboxSidebar.tsx:71](../src/components/whatsapp/InboxSidebar.tsx:71) is a fixed `w-80` column that always renders next to the chat. At 375px the chat pane gets about 55px: messages wrap one letter per line and the reply box is cut off. The page also widens to 426px, so the browser zooms out. Sales staff use WhatsApp from their phones.
**Fix:** below `md`, show the list on `/whatsapp/inbox` and only the chat on `/whatsapp/inbox/[id]`, with a back button in `ConversationHeader`. In the layout, use `hidden md:flex` on the sidebar when `params.id` is set.

### 3. Broker portal has no mobile layout
In [(broker-portal)/layout.tsx:22](../src/app/(broker-portal)/layout.tsx:22), `main` uses `ml-60` and [BrokerNav.tsx:37](../src/components/broker-portal/BrokerNav.tsx:37) is an always-visible fixed `w-60` sidebar. On a phone this leaves about 135px for content. Channel partners are field users, so most of them will open the portal on a phone.
**Fix:** use the same pattern as `ClientPortalNav`: `hidden md:flex` sidebar, `md:ml-60` main, and a top bar with a drawer or a bottom tab bar on mobile.

### 4. The "WhatsApp" button on leads opens the wrong number
[leads/[id]/page.tsx:66](../src/app/(dashboard)/leads/[id]/page.tsx:66) and [LeadsTable.tsx:174](../src/components/leads/LeadsTable.tsx:174) use `https://wa.me/${lead.phone}`.
- New leads are stored as 10 digits. Live example: `wa.me/8368233575` has no `91`, so WhatsApp reads `83…` as a country code.
- 31 of 34 existing leads are stored as `+91-98…`. The `+` and `-` make wa.me reject the link.

**Fix:** `wa.me/91${digits.slice(-10)}`, as [share/[token]/page.tsx:175](../src/app/share/[token]/page.tsx:175) already does. Put it in one `waLink(phone)` helper. Also consider pointing the button at the in-app conversation when one exists: it bypasses AgencyX today, so those chats never reach the CRM timeline.

---

## 🟠 P1

### 5. Times rendered on the server show in UTC, 5½ hours behind
`toLocaleString`/`toLocaleTimeString` without `timeZone` runs on Vercel in UTC.
- **Confirmed live:** at 5:40 pm IST, the newest audit-log row read **12:09 pm**.
- Affected:
  - [audit-logs/page.tsx:148](../src/app/(dashboard)/audit-logs/page.tsx:148)
  - [admin/security/page.tsx:117](../src/app/(dashboard)/admin/security/page.tsx:117) and line 157
  - [settings/security/page.tsx:36](../src/app/(dashboard)/settings/security/page.tsx:36)
  - [hr/attendance/page.tsx:10](../src/app/(dashboard)/hr/attendance/page.tsx:10): a check-in at 9:30 shows as 4:00 AM
  - [mobile/page.tsx:32](../src/app/(dashboard)/mobile/page.tsx:32)
  - [dashboard/page.tsx:53](../src/app/(dashboard)/dashboard/page.tsx:53): shows yesterday's date until 05:30 IST
- **"Today" is computed in UTC on the server.** There are 42 call sites using `new Date().toISOString().split('T')[0]` or `setHours(0,0,0,0)`. Examples:
  - `view=today` / `new_today` in [leads/queries.ts:61](../src/lib/leads/queries.ts:61): the "day" runs 05:30→05:29 IST.
  - Payment "overdue" counts, attendance "today", and the booking/cancellation dates written by [bookings/actions.ts](../src/lib/bookings/actions.ts). A booking made at 2 am IST is stamped with yesterday's date.

**Fix:** route every display through `formatInIST` / `formatDateTime` ([lib/datetime.ts](../src/lib/datetime.ts)). Add `todayIST()` and `istDayBounds()` helpers and replace the 42 sites. Extend `npm run lint:ui` to ban `toLocale(Date|Time)?String(` without `timeZone`.

### 6. Search input is pasted straight into PostgREST `or=` filters
[leads/queries.ts:90](../src/lib/leads/queries.ts:90), [brokers/queries.ts:22](../src/lib/brokers/queries.ts:22), [api/mobile/leads/route.ts:25](../src/app/api/mobile/leads/route.ts:25) and [CommandPalette.tsx:65](../src/components/layout/CommandPalette.tsx:65) all build `.or(\`full_name.ilike.%${term}%,…\`)`.
- A comma, `(` or `)` in the term (for example "Sharma, Rahul") breaks the filter. The query errors, and `getLeads` logs it and returns `[]`, so the user just sees "no leads".
- A `%` or `_` in the term acts as a wildcard.
- `sort_by` comes from the URL unchecked. Any typo or old link gives an empty list.
- Searching a phone with spaces ("98765 43210") never matches.

**Fix:** a `searchOr(cols, term)` helper that removes `,()` and escapes `%_`, plus a digits-only branch for phone search. Allow-list `sort_by`. Show an error state instead of an empty state when the query fails.

### 7. Page headers overflow on phones, so the browser zooms out the whole page
In [PageHeader.tsx:45](../src/components/ui/PageHeader.tsx:45) the actions row is `flex … shrink-0` and doesn't wrap. At 375px, measured page widths were:

| Page | Width | Cause |
|---|---|---|
| /leads | 591px | 5 header actions |
| /reports/sales | 507px | report tab strip |
| /settings | 502px | card grid |
| /team | 434px | header actions |
| /whatsapp/inbox | 426px | see #2 |

Mobile browsers then zoom out to fit, which shrinks text and tap targets to about 63%.
**Fix:** `flex flex-wrap items-center gap-2` (drop `shrink-0`), or collapse secondary actions into a "More" menu below `sm`. Make the report and settings tab strips `overflow-x-auto`.

### 8. Lead detail: three sequential round-trips
[leads/[id]/page.tsx:32-51](../src/app/(dashboard)/leads/[id]/page.tsx:32) runs `Promise.all(lead, activities, visits, projects)`, then `getActiveAdvisors`, then `checkDuplicate`. With iad1→Mumbai latency that is about 400 ms of avoidable wait on the most-used page.
**Fix:** start `getProfile()` and `getActiveAdvisors` in the first `Promise.all`. Only the duplicate check needs `lead.phone`, so make it a second step, or stream it in `<Suspense>`, since it is only a side panel.

### 9. Leads list sends every column of every row to the client
`LEADS_SELECT = '*, …'` ([leads/queries.ts:9](../src/lib/leads/queries.ts:9)) has 46+ columns, passed into the client component `LeadsTable`. The RSC payload serialises all of them. Measured: **277 KB HTML for 33 leads**, which would be about 400 KB at the 50-per-page limit. Kanban (219 KB) and overdue (176 KB) have the same problem.
**Fix:** a list-specific select with only the columns the table, kanban and SLA use. `computeSlaStatus` needs `stage`, `stage_changed_at`, `created_at`, `next_followup_at`. Keep `*` for the detail page.

### 10. Dashboard cards point to the wrong place
- **Overdue Follow-ups** and **Today's Follow-ups** link to plain `/leads` ([dashboard/page.tsx:87](../src/app/(dashboard)/dashboard/page.tsx:87)). They should go to `/leads?view=overdue` and `/leads?view=today`, which already exist. With 26 overdue leads, the most actionable number on the screen leads nowhere useful.
- The title is hard-coded `Good morning, …` ([line 60](../src/app/(dashboard)/dashboard/page.tsx:60)). Compute it from the IST hour.
- Bookings and Inventory share the `Building2` icon in the module grid.

---

## 🟡 P2

### 11. Dashboard runs manager-only queries for every role
`getBookingStats`, `getLoanStats` (3 queries) and `getPendingApprovals` ([dashboard/page.tsx:45](../src/app/(dashboard)/dashboard/page.tsx:45)) run for advisors and telecallers too, but their results only render when `isManager`. Gate them on the role.
- `getPendingApprovals` also selects the full `BOOKING_SELECT` with joins and no limit, to render a short list. Add `.limit(5)` and a trimmed select.

### 12. Hindi font preloaded on every page but unused
[app/layout.tsx:13](../src/app/layout.tsx:13) loads `Noto_Sans_Devanagari` in 4 weights with preload on. The console shows "preloaded but not used" on every page. Set `preload: false` (it stays the CSS fallback for Hindi text) and trim it to 1–2 weights.

### 13. No per-page titles
Every tab, history entry and bookmark reads "ANON INDIA CRM". Only 1 of 99 pages exports `metadata`. Set `title: { template: '%s · ANON CRM', default: 'ANON CRM' }` in the root layout and a static `metadata.title` per page. Add `generateMetadata` for the lead, client and booking detail pages so the title shows the record name. Screen readers announce the title on navigation, so this also helps accessibility.

### 14. WhatsApp inbox details
- **Search covers only the 100 conversations already loaded** ([InboxSidebar.tsx:9](../src/components/whatsapp/InboxSidebar.tsx:9), with client-side filtering in `ConversationList`). Older chats can't be found. Search on the server once the input has 2 or more characters.
- **Forced scroll:** [ChatWindow.tsx:92](../src/components/whatsapp/ChatWindow.tsx:92) scrolls to the bottom on every new message, even when the agent has scrolled up to read history. Only auto-scroll when already near the bottom; otherwise show a "New messages ↓" pill.
- **`h-[calc(100vh-4rem)]`** in [whatsapp/layout.tsx:19](../src/app/(dashboard)/whatsapp/layout.tsx:19): on mobile Safari and Chrome, `100vh` includes the URL bar, so the reply box sits below the fold. Use `100dvh`.
- **Read state:** `markRead` skips hidden tabs but never re-runs when the tab becomes visible, so a chat that is open in a background tab stays unread.
- **Copy:** "1 conversations" needs pluralising.

### 15. Kanban
- **No drag-and-drop:** [LeadsKanban.tsx](../src/components/leads/LeadsKanban.tsx) changes a stage through a per-card menu only. Add drag-and-drop on top of it, calling `changeLeadStage` with an optimistic move. The menu stays as the keyboard path.
- **Silent cap:** kanban loads `getLeads` with a silent 200-row cap ([leads/queries.ts:115](../src/lib/leads/queries.ts:115)). Above 200 leads, columns quietly miss cards. Show "Showing 200 of N" or load each column separately.

### 16. Settings still advertises two-factor authentication
The TOTP routes and pages are gone (no `/api/auth/2fa`, no `/verify-2fa`, and the proxy has no MFA gate), but [settings/page.tsx:20](../src/app/(dashboard)/settings/page.tsx:20) still says "Two-factor authentication and active sessions". Change the copy to match. If 2FA is wanted, Supabase Auth MFA is the route; it is already on the open items list.

### 17. ⌘K command palette
- **Out-of-order results:** there is no guard on stale responses, so a slow earlier query can overwrite newer results. Keep a request counter and ignore stale responses.
- **No error state:** a failed query looks the same as "no results".
- The same filter-injection problem as #6 applies here.

---

## ⚪ P3 (polish)

- **Notification badge:** the dot only counts unread items among the latest 20 ([NotificationBell.tsx](../src/components/layout/NotificationBell.tsx)) and shows no number. Use a `count: 'exact', head: true` query on `is_read=false` and show the count, capped at 9+.
- **Delete button placement:** on lead detail, the red **Delete** button sits in the same row as "Move to Interested" and "Move to Visit Scheduled". Move it to an overflow menu or the page footer. It is confirmed, but it is still an easy mis-click next to frequent actions.
- **Empty cards:** the lead detail "Interest" card renders as an empty box when a lead has no budget or property data. Show "No preferences captured · Edit".
- **Nav badges:** [useNavBadges.ts](../src/components/layout/useNavBadges.ts) calls the full `get_lead_stats` RPC every 60 s in every open tab, just to read `overdue`. A dedicated count RPC, or a 5-minute interval, is enough.
- **`supabase-js` in the shell (~62 KB gzip):** it ships on every page for the bell, badges and ⌘K. Acceptable, but ⌘K could be lazy-loaded with `next/dynamic` on first ⌘K press.
- **DB advisors:**
  - 26 `multiple_permissive_policies`. The cheapest wins:
    - `attendance`'s "Service role full access" policy is attached to `authenticated` and runs on every query. `service_role` bypasses RLS anyway, so drop the policy.
    - `*_read` + `*_write (ALL)` pairs on `projects`, `plots`, `dsas`, `bank_tieups`, `premium_matrix`. Split `write` into INSERT/UPDATE/DELETE so SELECT has one policy.
  - Leave the 102 unused indexes until there is production traffic.
- **Login cold start:** TTFB 2 s, LCP 6.4 s. Mostly #1. After moving region, re-measure. If it is still slow, the login page can be static (no server data).

---

## Suggested order

1. **Today (≈1 h, biggest gain):** #1 region, #4 wa.me, #7 PageHeader wrap, #10 dashboard links, #12 font preload, #16 copy.
2. **Next (≈1 day):** #5 IST helpers + lint rule, #6 search helper, #8 lead detail parallel, #9 list select, #11 role gating.
3. **Then (≈2 days):** #2 mobile inbox, #3 broker portal mobile, #14 inbox details, #13 titles.
4. **Later:** #15 kanban drag-and-drop, #17, P3.

**Verification for each item:** re-run the route timing script and the 375px width sweep from this audit. Both are read-only `fetch`/iframe checks in the browser console. Also run `npx tsc --noEmit`, `npm test` and `npm run lint:ui`.

## Not covered
- Client portal signed-in screens (no client login available).
- Real-device Safari testing.
- A full WCAG pass beyond what fix plans 1 and 2 already did.
