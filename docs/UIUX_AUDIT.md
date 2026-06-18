# ANON INDIA Real Estate — UI/UX Audit

**Scope:** Public marketing website (`website/`) — homepage, projects listing & detail, blog, content pages.
**Method:** Heuristic evaluation (Nielsen), visual/IxD review, conversion & lead-gen analysis, accessibility (WCAG 2.1 AA), responsive review (mobile 375px + desktop 1280px), code-level inspection.
**Overall maturity:** Strong visual foundation (typography, palette, motion) — **the gaps are conversion depth, accessibility, mobile polish, and real-estate-specific features**, not aesthetics.

**Heuristic scorecard (1–5):**

| Area | Score | One-liner |
|---|---|---|
| Visual design / brand | 4.5 | Editorial serif + warm palette, cohesive |
| Information architecture | 3.5 | Clear, but thin browse + no breadcrumbs |
| Conversion / lead-gen | 3.0 | Forms convert, but missing shortlist/compare/strong CTAs |
| Content & trust | 2.5 | Placeholder stats + stock avatars undercut credibility |
| Forms & microcopy | 3.0 | Low-friction, but no labels/validation feedback |
| Mobile / responsive | 2.5 | Floating buttons overlap content; mega-menu lost |
| Accessibility (AA) | 2.5 | Gold-on-white contrast fails; inputs lack labels |
| Performance | 3.5 | next/image + ISR good; some unoptimized `<img>` |
| SEO | 3.0 | Good metadata, **no structured data / sitemap** |

---

## 🔴 P0 — Critical (fix first)

1. **Floating action buttons overlap content.**
   `FloatingActions` (Call/WhatsApp/Enquire) sit bottom-right with a high z-index and cover real content: on **mobile** they obscure the hero trust line ("1000+ happy families"); on **desktop** they overlap the project-detail **enquiry form / Request Callback button**. This blocks the primary conversion action.
   → Collapse to a single FAB that expands on tap; add bottom padding to pages; never overlap forms.

2. **Gold text fails color-contrast (WCAG AA).**
   `gold-500` (#c49a3a) and `gold-600` (#a87e26) on white are ~3.0–4.0:1 — **below 4.5:1** for normal text. Affects "View all" links, prices on hover, eyebrows, "Read now". Legibility + accessibility risk.
   → Use `gold-700` (#86631c, ~5.2:1) for text on light; reserve `gold-500` for fills/large text only.

3. **Form inputs have no `<label>` elements.**
   `LeadForm` uses placeholder-only inputs ("Your Name", "Phone Number"). Placeholders disappear on focus, fail screen readers, and hurt completion.
   → Add visible or visually-hidden `<label>`s + `aria-label`; show inline validation + a success state.

4. **Trust signals are placeholders.**
   "4.9 Google rating", "1000+ happy families", "2,500+ investors", testimonial **stock avatars** (pravatar), RERA numbers "RAJ/P/XXXX". On a high-trust purchase (property), fabricated-looking proof actively erodes confidence.
   → Use real numbers, real photos (or remove avatars), and real RERA IDs — or label them honestly until available.

---

## 🟠 P1 — High impact

5. **Hero background image is over-darkened.**
   `opacity-25` + a heavy charcoal gradient renders the hero nearly flat black — the property imagery (the emotional hook for real estate) is barely perceptible.
   → Raise image opacity to ~40–50%, lighten the gradient, or use a brighter hero shot.

6. **Conversion depth is missing for a property portal.**
   No **shortlist/save**, no **compare**, no **map view**, no **EMI on cards**, no **"site visit" scheduler** on the public site. Buyers browse many units — there's nowhere to collect favourites.
   → Add a save-to-shortlist (localStorage → "your shortlist") and a "Book a site visit" CTA distinct from the generic enquiry.

7. **Project detail feels thin when data is sparse.**
   With no amenities/RERA/floor-plan, the page is just quick-facts + a paragraph + form — lots of empty space. No **breadcrumbs**, no **nearby/ similar projects**, no **locality highlights**, no **trust band**.
   → Always-on sections: "Why this location", "Similar projects", a sticky price+CTA bar, breadcrumbs, and graceful empty states.

8. **Search is minimal.**
   Hero search = City + Type only. No **budget**, **BHK**, or **keyword**. The listing has those filters but the hero (the highest-intent entry point) doesn't.
   → Add budget + BHK to the hero search; consider a prominent search on the listing too.

9. **Mobile loses the rich browse.**
   The Projects/Blog **mega-menus are desktop-only**; on mobile they collapse to plain links — mobile users (the majority) get the weakest navigation. No city/price quick-filters on mobile.
   → Give mobile an accordion browse (cities + types) or a dedicated filter sheet.

10. **No structured data / sitemap (SEO).**
    Real estate lives or dies on search. There's no JSON-LD (`Organization`, `RealEstateListing`/`Product`, `BreadcrumbList`, `AggregateRating`), and no confirmed `sitemap.xml` / `robots.txt`.
    → Add JSON-LD per project + org, a dynamic sitemap, and `robots.txt`.

---

## 🟡 P2 — Polish & refinement

11. **Homepage testimonials use `<img>` (not `next/image`)** → unoptimized avatar loads. Switch to `next/image` or a single sprite.
12. **`slow-zoom` hero animation ignores `prefers-reduced-motion`** (Reveal/CountUp respect it; the hero doesn't). Gate it.
13. **No breadcrumbs anywhere** — hurts orientation + SEO on listing/detail/blog.
14. **CTA hierarchy is flat** — "Get a Callback", "Free Consultation", "Enquire", "Request Callback", "Book a site visit" all compete. Define one primary verb and demote the rest.
15. **Empty/loading states** — listing/detail need skeletons; the detail page should never render a near-empty shell.
16. **Footer newsletter form is non-functional** (no action wired) — either wire it or remove.
17. **Reels "Follow us" + cards link to `instagram.com`** (placeholder) — point to the real handle or hide.
18. **Card density** — project cards are info-light (price, BHK, location). Add area (sq.ft), possession, and a "RERA ✓" already present — but consider a primary "Enquire" on the card, not just View/Call/WhatsApp.
19. **Focus-visible states** — verify keyboard focus rings on all interactive elements (gold ring exists on inputs; check nav, cards, FAB).
20. **Mega-menu hover-only** — no keyboard/tap access on desktop touch; add click/focus support and `aria-expanded`.

---

## ✅ What's working well (keep)

- **Typography** — Fraunces serif + italic accents + Inter body is distinctive and premium; consistent across pages.
- **Palette & rhythm** — charcoal + gold + warm cream alternation reads editorial, not template.
- **Motion** — scroll-reveals, card hover-lift, animated counters, the reels carousel, condensing nav — tasteful and performant.
- **Low-friction lead form** — name + phone only is the right call for Indian real estate conversion.
- **Mega-menus (desktop)** — the Projects (city→preview) and Blog (featured→list) menus are genuinely good.
- **Architecture** — ISR caching, `next/image`, `next/font`, clean component structure.

---

## Suggested sequencing

**Sprint 1 (P0, ~1–2 days):** FAB overlap fix · gold-700 text contrast · form labels + validation/success · replace placeholder trust signals.
**Sprint 2 (P1, ~3–4 days):** hero image visibility · hero budget/BHK search · shortlist + "book a site visit" · detail-page depth (breadcrumbs, similar projects, sticky CTA) · structured data + sitemap · mobile browse.
**Sprint 3 (P2, ~2 days):** image optimization · reduced-motion · CTA hierarchy · skeletons · footer newsletter · real social links.

**Bottom line:** the site *looks* premium — the work now is making it *convert and rank* like a serious property portal, and clearing the accessibility + mobile-overlap issues that currently undercut an otherwise strong design.
