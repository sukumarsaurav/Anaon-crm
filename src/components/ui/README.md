# UI Design System

This is the spec for `src/components/ui/*`. **All page-level styling must conform to these tokens.** When in doubt, use the component, not raw Tailwind.

---

## Color palette

Single neutral family: **slate**. Never use `gray-*`, `zinc-*`, or `neutral-*`.

| Role            | Token                                        |
| --------------- | -------------------------------------------- |
| Page background | `bg-slate-50` (set on `<body>`)              |
| Card surface    | `bg-white`                                   |
| Card border     | `border-slate-200`                           |
| Strong text     | `text-slate-900`                             |
| Body text       | `text-slate-700`                             |
| Muted text      | `text-slate-500`                             |
| Disabled text   | `text-slate-400`                             |
| Hover surface   | `hover:bg-slate-50` or `hover:bg-slate-100`  |

**Primary accent:** `indigo-600` (buttons, focus rings, active states).
**Semantic colors:** `emerald-*` (success), `amber-*` (warning), `red-*` (error), `blue-*` (info). Avoid `green-*`, `orange-*`, `yellow-*` in new code.

---

## Border radius scale

| Radius          | Used for                                                          |
| --------------- | ----------------------------------------------------------------- |
| `rounded-md`    | small inline chips, dense filters                                 |
| `rounded-lg`    | **controls**: Button, Input, Select, Textarea, icon buttons       |
| `rounded-xl`    | **surfaces**: Card, Modal, Alert, info banners, filter bars       |
| `rounded-full`  | avatars, dots, status pills (`<Badge>`), counter chips            |

Never use `rounded`, `rounded-sm`, `rounded-2xl`, or `rounded-3xl`.

---

## Spacing scale

### Page

- Main content: `p-6 space-y-6`
- Form pages: `p-6 max-w-3xl mx-auto space-y-6`
- Detail pages: `p-6 space-y-6` (no max-w constraint)

### Cards

| Padding | Token | Use                                |
| ------- | ----- | ---------------------------------- |
| Tight   | `p-4` | dense KPI tiles in a 6-col grid    |
| Default | `p-5` | most cards (`<Card padding="md">`) |
| Roomy   | `p-6` | feature cards with prose body      |

Use `<Card>` always — don't roll a raw `bg-white rounded-xl border border-slate-200` div.

### Grids

- Section gap inside a page: `space-y-6`
- Stat-card grid: `gap-4`
- Two-column form: `grid grid-cols-1 sm:grid-cols-2 gap-4`

---

## Typography

| Role             | Token                                            |
| ---------------- | ------------------------------------------------ |
| Page title (H1)  | `text-2xl font-bold text-slate-900`              |
| Page subtitle    | `text-sm text-slate-500 mt-0.5`                  |
| Section heading  | `text-sm font-semibold text-slate-900 mb-3`      |
| Card title       | `text-base font-semibold text-slate-900`         |
| Body             | `text-sm text-slate-700`                         |
| Helper / meta    | `text-xs text-slate-500`                         |
| Table header     | `text-xs font-semibold text-slate-600 uppercase tracking-wide` |
| Form label       | `text-sm font-medium text-slate-700`             |

Never use `text-xl` for a page title. Detail and form pages get `text-2xl` too.

---

## Icon size scale

| Size | Use                                                       |
| ---- | --------------------------------------------------------- |
| 12   | inline meta (badges, dots)                                |
| 14   | dense lists, table cell icons                             |
| 16   | inside buttons, inside inputs                             |
| 18   | toolbar / nav icons, back arrow                           |
| 20   | StatCard, section-header icons                            |
| 40   | empty-state hero icon                                     |

Never use 13, 15, 17, 19. Pick the nearest scale value.

---

## Buttons

Always use `<Button>` from `./Button.tsx`. Never style a raw `<button>` or `<Link>` to look like a button.

Variants: `primary` (indigo), `secondary` (white + slate border), `ghost` (no background), `outline` (indigo border), `danger` (red), `success` (emerald).

Sizes: `xs` / `sm` / `md` (default) / `lg`.

For navigation that looks like a button (e.g., "View all →"), wrap a `<Link>` with `<Button asChild>` (or pass `href` if we extend the component). Never paste `bg-indigo-600 text-white …` inline.

---

## Inputs

Always use `<Input>`, `<Select>`, or `<Textarea>` from this folder. They share the same palette (slate), border (`border-slate-300`), focus ring (`focus:ring-indigo-500/30 focus:border-indigo-500`), and disabled state.

Required fields show a red asterisk automatically when `required` is set — don't bake `*` into the label text.

---

## Status indicators

Use `<Badge>` for static labels. Use `<StatusBadge>` (Phase 1.4 primitive) for any value that maps a domain enum (lead stage, booking status, commission status, etc.) to a color. Never paste `bg-green-50 text-green-700 rounded-full px-2 py-0.5` inline.

---

## Tables

Use the `<DataTable>` primitive (Phase 1.5). It enforces:

- Header: `bg-slate-50 border-b border-slate-200`, `<th>` `px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide`
- Row: `border-b border-slate-100 hover:bg-slate-50`
- Cell: `px-4 py-3 text-sm text-slate-700`
- `overflow-x-auto` wrapper for mobile

---

## Empty states

Use `<EmptyState>` (Phase 1.2). Centered, `py-12`, icon size 40, optional CTA.

---

## Alerts

Use `<Alert>` (Phase 1.3). Variants: `info` (blue), `success` (emerald), `warning` (amber), `error` (red). Standard shape: `rounded-xl border p-4 flex gap-3 items-start`.

---

## Page header

Use `<PageHeader>` (Phase 1.1) for every top-level page:

```tsx
<PageHeader
  title="Leads"
  subtitle="Manage and track your sales pipeline"
  backHref="/dashboard"          // optional → renders Pattern B back button
  actions={<Button>...</Button>}
/>
```

---

## Currency & dates

- Currency: `formatCurrency(n)` for compact (`₹1.2Cr / ₹85L / ₹50K`); `formatCurrency(n, { precision: 2 })` for financial reports; `formatCurrency(n, { mode: 'exact' })` for ledger / invoice values.
- Date: `formatDate(d)` ("12 Jan 2025") in lists & tables; `formatDateTime(d)` for stamps; `formatRelative(d)` for ages and "X ago" copy. Don't mix relative + absolute in the same view.

---

## Don'ts

- Don't roll a card / button / input / modal from scratch.
- Don't introduce a new color family (`gray`, `zinc`, `neutral`).
- Don't introduce a new radius (`rounded`, `rounded-2xl`).
- Don't downgrade a page H1 to `text-xl` because the form is short.
- Don't use icon size 13/15/17/19 just because it "fits better."
- Don't paste status colors inline.
- Don't paste `₹` template literals — use `formatCurrency`.
