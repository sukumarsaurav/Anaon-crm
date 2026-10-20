# CRM UI/UX Fix Plan, Round 2 (follow-ups)

Continues [UIUX_FIX_PLAN.md](UIUX_FIX_PLAN.md). Decisions: delete = admin only; dark mode = dropped. Status below.
Order is by value/risk: A and B are small and safe, C is the bulk of the work, D needs a decision.

| # | Item | Size | Needs decision? |
|---|------|------|-----------------|
| A | Wire "Delete lead" on the lead detail page | DONE (admin-only button; deleted leads now 404 by URL) | - |
| B | Focus trap for `PlotDetailPanel` (shared `Drawer`) | DONE (`useDialogBehavior` shared by `Modal` + new `Drawer`) | - |
| C | Remaining 36 hand-written tables + table-row empty states | DONE in a lighter form (see below) | - |
| D | Dark mode | CANCELLED by owner | - |
| E | Safer codemods / process | PARTIAL (`scripts/codemods/tables.py` has dry-run; repo still uncommitted) | - |

---

## A. Delete lead (LeadDetailActions)

**State:** `handleDelete` (with confirm dialog + toast) exists but no button calls it; `Trash2` is imported unused.
`deleteLead` (`lib/leads/actions.ts:529`) is a soft delete (`is_active=false`), admin-only, writes an audit row.

**Decision for you:** show the button to admins only (matches the server rule; recommended), or also managers (needs a server change).

**Steps**
1. Read `useProfile().role` in `LeadDetailActions`; render a `variant="ghost"` danger button with `Trash2` only when `role === 'admin'`.
2. Wire it to the existing `handleDelete`; disable while `isPending`.
3. Improve the confirm copy to say it is hidden, not erased (soft delete), and name the lead.
4. Check the leads list, kanban, counts and search exclude `is_active=false` rows; fix any that don't.
5. Test: add a vitest case in `tests/actions` for non-admin rejection if missing; manually verify delete, redirect to `/leads`, toast, audit log row.

**Done when:** admin sees and can use it; others never see it; deleted lead disappears everywhere.

---

## B. PlotDetailPanel focus trap

**State:** side drawer has `role="dialog"`, Escape and a labelled close button, but focus can tab out behind it and isn't restored.

**Steps**
1. Extract the focus-trap + scroll-lock + focus-restore logic already in `ui/Modal.tsx` into `useDialogBehavior(open, onClose, panelRef)`.
2. Make `Modal` use the hook (no behaviour change; keep the `onCloseRef` fix).
3. Create `ui/Drawer.tsx` (right-side panel, same hook, `aria-labelledby`).
4. Replace the hand-rolled markup in `PlotDetailPanel` with `Drawer`.
5. Test: Tab/Shift+Tab cycle inside, Escape closes, focus returns to the clicked plot.

**Done when:** README rule "Modals always use Modal; drawers use Drawer" is true and `lint:ui` allow-list for `PlotDetailPanel` is removed.

---

## C. Tables and table-row empty states

**State:** 36 hand-written `<table>`s; only `LeadsTable` is responsive and sortable. ~6 "No X found" rows inside `<tbody>`.

**Approach:** migrate in batches by page type; don't force everything into `DataTable`. Use `DataTable` for simple read-only tables; for tables with bulk-select, inline actions or grouped rows, apply the same responsive pattern in place.

**Steps**
1. **Inventory (0.5h):** script that lists each table, column count, and whether it has row actions/selection. Output a checklist in this file.
2. **Extend `DataTable` (0.5d):** add `rowHref`/`onRowClick`, `caption`/`aria-label`, sticky header, `emptyState` prop wired to `EmptyState` (so the table-row empty cases disappear), and a `mobileCard` render prop for below `sm`.
3. **Batch 1, reports (5 pages, read-only):** `reports/{sales,pipeline,financial,leads,inventory}`. Lowest risk.
4. **Batch 2, lists:** `brokers`, `loans`, `audit-logs`, `legal`, `marketing`, `team/targets`, `hr/payroll`, `admin/security`, `mobile`.
5. **Batch 3, portals and components:** broker-portal commissions/leads, `share/[token]`, `CommissionBatchPanel`, `OverdueLeadsTable`, `ROITable`, cost sheet / letter views.
6. **Leave alone:** printable documents (`AllotmentLetterView`, `DemandLetterView`, `CostSheetView`, CSV preview). Only add `overflow-x-auto` and `scope="col"`.
7. Sorting: add server-driven sorting (URL params, as in leads) only to tables where users sort today (brokers, loans, audit-logs, payments). Others stay unsorted.
8. After each batch: `tsc`, `lint:ui`, `next build`, and a 375px + 1280px visual check.

**Done when:** every list table either uses `DataTable` or hides secondary columns below `md`, and no `<tbody>` contains a bare "No X found" cell.

---

## D. Dark mode

**State:** 0 `dark:` classes; colours are hard-coded Tailwind slate/white across ~280 files; `globals.css` has only a few tokens; body text colour and scrollbar are hard-coded.

**Decisions needed from you**
1. Do you want dark mode at all (internal CRM used all day, so likely yes for sales staff)?
2. Scope: staff dashboard only (recommended first), or client/broker portals too (they have their own dark branded login).
3. Toggle: follow OS only, or user toggle saved to profile/localStorage.

**Approach (if yes):** semantic tokens, not `dark:` on every class.
1. Add tokens in `globals.css`: `--surface`, `--surface-muted`, `--border`, `--text`, `--text-muted`, defined for light and for `.dark`, exposed via `@theme` (`bg-surface`, `text-fg`, `border-line`).
2. Codemod, mechanical and re-runnable: `bg-white -> bg-surface`, `bg-slate-50 -> bg-surface-muted`, `border-slate-200 -> border-line`, `text-slate-900/700/500 -> text-fg/fg-2/fg-muted`. Run only on `src/components/ui`, layout, then pages in batches.
3. Semantic colours (success/warning/error badges, alerts): add dark variants in `Badge`, `StatusBadge`, `Alert` only.
4. Charts/PDF/printable views: force light (documents must print light).
5. Toggle in the profile menu; apply class before paint (inline script in root layout) to avoid flash.
6. Extend `lint:ui` to flag raw `bg-white`/`text-slate-900` once migrated.
7. Contrast check on both themes (WCAG AA) for text, badges and focus ring (focus ring currently uses a hard-coded white offset).

**Risk:** biggest and touches everything; ship behind the toggle, default stays light until QA passes.

---

## E. Process: avoid repeating the earlier slip

1. Commit the current work first (or work on a branch) so any codemod can be reverted per file, not by stash.
2. Every codemod: dry-run mode that prints diffs, a guard that aborts if a match contains `<form`/exceeds N lines, and a post-run `tsc` before moving to the next file.
3. Keep the codemods in `scripts/codemods/` (idempotent) so they can be re-run.

---

## Suggested sequence
1. E (commit/branch) -> A -> B (one PR, ~half a day).
2. C step 1-2, then batches 1-3 (one PR per batch).
3. D only after you answer the three questions; start with tokens + `ui/` components.

## Outcome of C (what was actually done)
Instead of migrating every table to `DataTable`, one re-runnable codemod (`scripts/codemods/tables.py`, dry-run by default) was applied to all non-document tables:
- 8 tables that had no horizontal-scroll wrapper now have one.
- `scope="col"` on 180 header cells.
- Tables with 7+ columns keep their first column sticky while scrolling sideways (11 tables).
- 7 in-table empty rows became `EmptyState` with a next step (brokers, team targets, audit logs, broker-portal commissions, commission batches, 2 in pipeline report).
Not done: per-table mobile card layouts, and server-side sorting for other tables (no table other than leads is sorted by users today).
Left untouched on purpose: printable documents (allotment/demand letters, cost sheet) and CSV preview.
