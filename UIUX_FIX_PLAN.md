# CRM UI/UX Fix Plan

Source: UI audit of `crm/` (code-level). Status is updated as phases land.

| # | Phase | Scope | Status |
|---|-------|-------|--------|
| 1 | Foundations | `ConfirmDialog` + `useConfirm`, toast provider (`useToast`), `error.tsx` / `global-error.tsx` / `not-found.tsx`, missing `loading.tsx` | Done |
| 2 | Native dialogs | Replace all 12 `confirm()` + `ActionButton` confirm/prompt with ConfirmDialog; toast on action results | Done |
| 3 | Form a11y | Codemod: associate every `<label>` with its control (`htmlFor`/`id`) | Done (258 labels + 27 placeholder aria-labels + 25 unnamed controls) |
| 4 | Tables | `DataTable` gains sortable headers; `LeadsTable` hides secondary columns on small screens, sortable | Done (LeadsTable sortable + responsive; DataTable sortable API) |
| 5 | Navigation | Role-based sidebar filtering, persisted collapse state, drawer Escape/focus, TopBar compaction | Done (role filter, badges, Esc, collapsed profile menu, persisted collapse, compact TopBar) |
| 6 | Empty/loading | Shared `EmptyState` used for ad-hoc "No X found" text where simple | Done for standalone empty states (22); table-row/ternary cases left |
| 7 | Design-system drift | gray/zinc/neutral -> slate, rounded-2xl/3xl -> xl, sub-12px text -> text-xs, README corrected, custom modals -> `Modal` | Done (184 palette, 20 radius, 8 font-size, 5 modals -> Modal; README fixed) |
| 8 | Modal polish | Return focus to trigger on close; `<img>` avatars -> shared `Avatar` | Done (focus restore, Avatar) |
| 9 | Guardrail | `npm run lint:ui` script that fails on banned classes / native confirm | Done (`npm run lint:ui`) |

Verification after every phase: `npx tsc --noEmit`, then `npm run lint` on touched files.
Out of scope: dark mode (needs a design decision on palette), full migration of all 37 hand-written tables to `DataTable`.

## Verification (run at the end)
- `npx tsc --noEmit` clean; `npx vitest run` 284/284; `npx next build` succeeds; `npm run lint:ui` OK.
- ESLint error count unchanged from baseline (118, all pre-existing: `no-explicit-any`, `set-state-in-effect`).
- Browser-checked: /login labels, ids, no console errors. Signed-in screens were NOT exercised (no test credentials).

## Still open
- Remaining 37 hand-written tables (only `LeadsTable` was reworked) and table-row empty states.
- `PlotDetailPanel` is a side drawer (not `Modal`): has role/Escape but no focus trap.
- Dark mode (needs a palette decision). `LeadDetailActions.handleDelete` is unused (no delete button wired).
