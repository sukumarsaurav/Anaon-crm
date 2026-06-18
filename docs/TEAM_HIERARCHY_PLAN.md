# Team Hierarchy (Chain) + Lead Visibility + CSV Import — Plan

Replace **Announcements** in the Team module with **Teams**: a self-building **chain** where every member can add juniors beneath them, leads are assigned (by admin) to a specific member, and a lead + its status are visible **only to that member and the seniors above them in the chain** — never to peers or other teams. Plus **CSV bulk lead import**.

**Status legend:** ✅ exists · 🟡 partial · 🔴 new

## The model (named teams in a chain)

A **`teams`** table is the spine. Each team has a **leader**, **members**, and an optional **parent team** — so teams nest into a chain. A member can spin up a **junior team** beneath their team.

```
Admin
 └─ Team A (leader: Senior A) ───────────┐  (arrow = parent_team_id)
     ├─ member A1 ─ creates ▶ Team A1 (leader: A1)
     │                          └─ member A1a
     └─ member A2
 └─ Team B (leader: Senior B)
     └─ member B1
```

**Visibility rule (the core):** a lead assigned to **A1a** is visible to **A1a → A1 (their team leader) → Senior A (parent-team leader) → Admin** and *nobody else*. Equivalently: a viewer sees a lead **iff the assignee belongs to a team in the viewer's team-subtree**. Peers (A2, B1) and other teams (Team B) see nothing — in the query *and* in RLS.

---

## Phase 1 — Teams table + subtree primitives (1 day)

- [ ] 🔴 **`teams` table**: `id, name, leader_id → profiles, parent_team_id → teams (self-FK), branch_id, is_active, created_at`. Cycle guard on `parent_team_id`.
- [ ] 🔴 **`profiles.team_id` → teams** (which team a member belongs to). Keep `reporting_manager_id` auto-synced to the team leader.
- [ ] 🔴 **`get_team_subtree(root uuid) → setof uuid`** (recursive CTE, SECURITY DEFINER): a team + all descendant teams.
- [ ] 🔴 **`current_user_visible_members()`** → all profile ids whose team is in the caller's team-subtree (leader of any team → that team's subtree; admin → all; plain member → just self).
- [ ] 🔴 Backfill: create initial teams from existing branches/roles and set `team_id` so current users form a starting chain.

**Acceptance:** `get_team_subtree(TeamA)` returns Team A1; `current_user_visible_members()` for A1 returns A1 + A1a only.

---

## Phase 2 — Team nav swap + self-building chain UI (2 days)

- [ ] 🔴 **Remove "Announcements"** tab from `team/layout.tsx`; add **"Teams"** tab → `/team/teams`. (Announcements page retired/unlinked.)
- [ ] 🔴 **Org-chain / tree view** `/team/teams` — scoped to the viewer's subtree (admin sees the whole company; a member sees themselves + downline). Expand/collapse nodes; each node shows person, designation, junior count.
- [ ] 🔴 **"Add Junior"** on a node — **creates a new CRM user** (Supabase admin API: email + temp password / invite) placed in the member's team, or spins up a **junior team** under it with the new user as leader. Any member can add beneath themselves; admin anywhere.
- [ ] 🔴 **Move / re-parent** a team under a different parent (admin), with cycle protection.
- [ ] 🟡 Keep Overview / Targets / Attendance tabs.

**Acceptance:** a member can add a junior beneath them and see the new sub-chain; admin can build "Admin → Senior → Member → Junior" visually.

---

## Phase 3 — Chain-based lead visibility (1.5 days)

The payoff: assignment + strict upward-only visibility.

- [ ] 🟡 **Lead scoping** (`lib/leads/queries.ts`): a viewer sees leads where `assigned_to ∈ current_user_visible_members()` (plus their own created). Replaces branch-based scoping. Admin → all.
- [ ] 🟡 **RLS** on `leads` (+ `lead_activities`, `site_visits`): API-level policy so other teams physically cannot read the lead or its status.
- [ ] 🟡 **Assignment** — **admin and seniors** assign a lead to a member; the AssignModal lists assignable members = assigner's visible-members set (admin = all, senior = their subtree).
- [ ] 🟡 Overdue view, smart lists, reports automatically respect the new scope (they reuse `getLeads`).

**Acceptance:** lead assigned to A1a is visible to A1a / A1 / Senior A / admin; A2 and Senior B's team get 0 rows (query *and* RLS).

---

## Phase 4 — CSV lead import (1 day)

- [ ] 🔴 **`/leads/import`** page (admin/manager): upload `.csv`, **map columns** (name, phone, email, city, source, budget, requirement…), **preview + validation**, phone **dedupe**.
- [ ] 🔴 Parse via `papaparse`; push each row through the existing **`ingestLead`** normalizer (dedupe + score + activity + automations).
- [ ] 🔴 **Assignment choice on import**: round-robin/rules, or assign the whole batch to a chosen **member** (within the importer's subtree).
- [ ] 🔴 Import summary: created / duplicates / skipped, with row-level errors.

**Acceptance:** uploading a 50-row CSV creates source-tagged, de-duped leads assigned per the chosen rule, with a clear summary.

---

## Sequencing

| Phase | Theme | Est. | Depends on |
|---|---|---|---|
| 1 | Hierarchy primitives + subtree fn | 1 d | — |
| 2 | Teams nav swap + self-build chain UI | 2 d | 1 |
| 3 | Chain-based visibility + assignment | 1.5 d | 1 |
| 4 | CSV lead import | 1 d | — (independent) |

**Recommended order:** 1 → 2 → 3 → 4. Phases 1–3 deliver the chain + strict visibility; 4 adds bulk import.

## Cross-cutting
- Cycle guard everywhere a `reporting_manager_id` is set (no member becomes its own ancestor).
- All visibility via SECURITY DEFINER subtree functions; RLS enforces it server-side, not just in the query layer.
- Removing Announcements: drop the tab + route; keep the table (harmless) or migrate later.

## Decisions (resolved)
1. **Spine** — a separate **`teams` table** (named teams, leader + members + parent team). The chain = `parent_team_id`.
2. **"Add Junior"** — **creates a new CRM user** (Supabase admin API) under the member's team / as a junior-team leader.
3. **Who assigns leads** — **admin + seniors** within their own subtree.
4. **Senior visibility** — **full lead + status** for everyone up the chain (assumed).
