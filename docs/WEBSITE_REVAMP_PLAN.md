# Website Revamp Plan — MoneyTree-style frontend + Login → Admin

Rebuild the public site (`website/`) modeled on [moneytreerealty.com](https://moneytreerealty.com/): a property-consultant portal that browses live projects, captures leads, and whose **Login opens the admin** (the CRM at `dashboard.domain.com`). The CRM remains the single admin/CMS — the website is its public face over the **same Supabase**.

**Status legend:** ✅ exists · 🟡 partial · 🔴 new

> **Progress:** Phases **A, B, C shipped & verified** (charcoal/gold theme, logo, nav+dropdown+Login, footer w/ RERA, floating actions; `developers`/`team_members` tables + `projects` website fields + seed; full MoneyTree-style homepage). Build clean. **Key fix:** added anon RLS read on `projects` (active) + `plots` so the public site can read them. Remaining: **D** (listing+detail), **F** (role-based login), **E** (secondary pages), plus optional CRM admin screens for developers/team.

---

## Reference model (MoneyTree) → our mapping

| MoneyTree element | Our plan |
|---|---|
| Green + gold/yellow theme, card grids, carousels | Re-theme site (currently blue) → green/gold tokens |
| Nav: Projects, CSR, Blogs, Career, Contact, More▾ (About, Developers, Testimonials, Events, Awards, Vision) | Expand nav + dropdown |
| Hero with city/type **search** | Hero + search bar → `/projects?city=&type=` |
| Popular Properties carousel (price, BHK, View/Call/WhatsApp) | Featured carousel from `projects` |
| Trust badges (15+ yrs, happy investors, pan-India) | Stats strip |
| Associated Developers logo grid | `developers` table + grid |
| Premium Properties with tabs (All / Luxury 3-4BHK / Commercial) | Category-tabbed project grid |
| Explore by City cards | City cards from project cities |
| Meet the Team (advisors w/ photos) | `team_members` (or public `profiles`) |
| Testimonials w/ verified badges + Google rating | Already have `testimonials` — restyle |
| Why Choose Us (4 props) | Value-prop section |
| CTA: Free consultation / View properties | CTA band → lead form |
| Blog/insights | Already have `blog_posts` — restyle |
| Footer: address, socials, quick links, legal, newsletter, **RERA numbers** | Expand footer |
| Floating Call / Enquire / WhatsApp | Add floating action buttons |

---

## Phase A — Design system & shell (0.5–1 day)

- [ ] 🔴 **Theme tokens** — green primary + gold/amber accent in `globals.css` / Tailwind config; replace blue usage site-wide.
- [ ] 🟡 **Nav revamp** (`Nav.tsx`) — full menu + "More ▾" dropdown; keep **Agent Login** (already wired to `NEXT_PUBLIC_DASHBOARD_URL`) styled as primary "Login".
- [ ] 🟡 **Footer revamp** (`Footer.tsx`) — address, 5 socials, Quick Links, Legal, newsletter form, **RERA registration numbers**, copyright.
- [ ] 🔴 **Floating actions** — sticky Call / WhatsApp / Enquire (mobile-first).

---

## Phase B — Content models (CMS-backed) (1 day)

Public content the CRM admin will manage. New tables (RLS: public read, authenticated write):

- [ ] 🔴 `developers` — name, logo_url, is_active, sort_order. (Associated Developers grid.)
- [ ] 🔴 `team_members` — name, designation, photo_url, level, sort_order, is_public. *(Or expose public `profiles` — decide in build.)*
- [ ] 🔴 Extend `projects` with website fields: `developer_id`, `starting_price`, `price_per_sqft`, `bhk_config` (e.g. "2,3,4 BHK"), `category` (residential/luxury/commercial), `is_featured`, `hero_image_url`. *(Reuse existing `gallery_urls`, `layout_image_url`, `brochure_url`, `amenities`, `google_maps_pin`, `expected_completion_date`, `rera_number`.)*
- [ ] ✅ `testimonials`, `blog_posts`, `career_listings` already exist — reuse.
- [ ] 🔴 CRM admin screens for `developers` / `team_members` / new project fields (in `crm/`, under Website/Inventory modules).

---

## Phase C — Homepage rebuild (1.5–2 days)

Compose sections top-to-bottom (`website/src/app/page.tsx` + new components in `website/src/components/home/`):

1. 🔴 **Hero** + integrated search (city dropdown, property type) → `/projects`.
2. 🟡 **Popular Properties** carousel (featured projects: image, price, BHK, View/Call/WhatsApp).
3. 🔴 **Trust strip** (years, investors, pan-India — static/config).
4. 🔴 **Associated Developers** logo grid (`developers`).
5. 🟡 **Premium Properties** with category tabs (All / Luxury / Commercial).
6. 🔴 **Explore by City** cards (distinct project cities + counts).
7. 🔴 **Meet the Team** (advisors with photos).
8. 🟡 **Testimonials** (restyle, verified badges, aggregate rating).
9. 🔴 **Why Choose Us** (4 value props).
10. 🟡 **CTA band** → free-consultation lead form.
11. 🟡 **Blog/Insights** (latest 3 posts).

---

## Phase D — Projects listing + detail (1.5–2 days)

- [ ] 🟡 **Listing** (`/projects`) — richer filters: **city, property type, budget range, BHK, status**; sortable; MoneyTree-style cards (price, developer, BHK, status badge, View/Call/WhatsApp); responsive grid.
- [ ] 🟡 **Detail** (`/projects/[id]`) — overview, **pricing/starting price**, BHK/configs, **floor plan / layout**, **amenities**, **location map** (Google pin), **gallery**, **RERA**, **brochure download**, **EMI calculator** (exists), **enquiry form** (exists). Sticky "Talk to expert" + Call/WhatsApp.

---

## Phase E — Secondary pages (1 day)

- [ ] ✅/🟡 About (exists), Contact (exists), Blog (exists), Careers (exists), Gallery (exists), Privacy/Terms (exist) — restyle to new theme.
- [ ] 🔴 **Associated Developers**, **Testimonials** (full page), **CSR**, **Events**, **Awards & Recognition**, **Vision & Mission** — content pages (CMS or static).

---

## Phase F — Lead capture + Login → Admin (0.5 day)

- [ ] ✅ **Lead capture** — every enquiry/search/consultation form writes a lead (source `website_form`). Already flows to Supabase + `/api/webhooks/leads/website`; ensure all new forms use it so leads land in the CRM pipeline (auto-assigned via rules).
- [ ] ✅ **Login → Admin** — the nav "Login" points to `dashboard.anonindia.com` (the CRM). Logging in there opens the dashboard/admin. Already wired via `NEXT_PUBLIC_DASHBOARD_URL` (Phase architecture).
  - Decision needed: single "Login" (→ CRM, for agents/admin) **or** also a separate **customer login** (→ CRM client-portal for buyers). Default: one "Login" → CRM; customers use enquiry forms.

---

## Sequencing & estimate

| Phase | Theme | Est. |
|---|---|---|
| A | Design system + shell | 0.5–1 d |
| B | Content models + CRM admin | 1 d |
| C | Homepage rebuild | 1.5–2 d |
| D | Projects listing + detail | 1.5–2 d |
| E | Secondary pages | 1 d |
| F | Lead capture + login wiring | 0.5 d |

**~6–8 days.** Recommended order: A → B → C → D → F → E.

## Cross-cutting

- Website stays **read-mostly** over Supabase (anon key); writes only via lead forms. Admin/content editing happens in the CRM.
- Keep ISR (`revalidate`) on public pages for speed; projects/blogs already use it.
- Migrations via Supabase MCP; RLS public-read on website-facing tables.
- No new auth on the website — login = redirect to the CRM (`dashboard.domain.com`).
- Images via Supabase Storage; use `next/image` where possible.

## Decisions (resolved)
1. **Login** — single **role-based** login. The website "Login" → CRM login; after auth the CRM routes by role: `client` → `/client-portal`, staff (`admin`/`manager`/`sales_advisor`/`telecaller`) → `/` dashboard.
2. **Team source** — dedicated `team_members` table (public, decoupled from auth `profiles`).
3. **Brand palette** — derived from the B&W ANON INDIA logo: **charcoal/black primary + warm gold accent + white** (premium, minimalist). Logo at `website/public/logo.png` (user to drop the asset).
4. **Domain** — apex `anonindia.com`, CRM at `dashboard.anonindia.com`.
