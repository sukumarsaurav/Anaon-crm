# Sales Pipeline — Feature List

Feature spec for the ANON INDIA CRM sales pipeline, modeled on [3Sigma CRM for Real Estate](https://www.3sigmacrm.com/industries/real-estate) and adapted to our stack (Next.js 14 + Supabase).

**Status legend:** ✅ Already built · 🟡 Partial / needs work · 🔴 New to build

---

## 1. Automatic Lead Capture

Every source feeds directly into the pipeline — no copy-paste, no manual entry. A lead arrives with name, number, source, and requirement, then enters the pipeline automatically.

| Source | Status | Notes |
|---|---|---|
| 99acres / MagicBricks / Housing | 🔴 | Real-estate portal inquiries captured & assigned |
| IndiaMart | 🔴 | Auto-import as leads on arrival |
| Facebook / Instagram Lead Ads | 🟡 | Meta webhook exists (`api/webhooks/meta-leads`) — verify Instagram + form mapping |
| Google Lead Form / Google Ads | 🔴 | Source tagged automatically |
| JustDial | 🔴 | Captured and auto-assigned |
| WhatsApp inquiries | 🟡 | WhatsApp module exists — wire inbound chat → lead with conversation history |
| Website / Custom forms (WordPress, Wix) | 🟡 | Website module exists — confirm form → lead webhook |
| LinkedIn | 🔴 | Lead capture from campaigns |
| Google Contacts / Forms / Sheets | 🔴 | Optional bulk/sync sources |
| CSV / Excel import | 🟡 | Bulk upload of existing lists without re-entry |
| Webhooks (generic) | 🔴 | Catch-all inbound endpoint for any source |
| Call logs | 🔴 | Mobile call log → lead |

**Every lead is source-tagged automatically** for downstream reporting.

---

## 2. Auto-Assignment

Set rules once; leads route to reps automatically — no group-chat posting.

- 🟡 **Assignment rules engine** — exists; extend rule types below
- 🔴 By **area / territory** (e.g., Jaipur zones, expansion cities)
- 🔴 By **property type** (Flats / Villas / Plots / Commercial)
- 🔴 By **budget band** (Under 50L / 50L–1Cr / 1Cr+)
- 🔴 By **source**
- 🟡 **Round-robin / equal distribution**
- 🔴 By **rep availability**

---

## 3. Pipeline View (Stages)

See all leads by stage; drag leads across stages from any device.

- ✅ **Kanban board** (`LeadsKanban.tsx`) with drag-and-drop
- ✅ **Stage badges** + per-stage counts (`StageBadge.tsx`, `LeadsStats.tsx`)
- 🟡 **Real-estate stage set** — align to: `New Inquiry → Site Visit Scheduled → Site Visit Done → Negotiation → Token Paid → Deal Closed`
- ✅ **Table view** with filters (`LeadsTable.tsx`, `LeadFilters.tsx`)
- 🔴 **Pre-built smart lists** — Hot Leads, Site Visits This Week, Need Follow-up Today, Ready to Buy, Future Buyers

---

## 4. Follow-up System

The core promise: *no lead is silently abandoned.* A lead is always either actively followed up, flagged overdue, or marked with a final outcome.

- 🟡 **Schedule follow-up from the call/lead screen** (`FollowUpModal.tsx`) — set next date+time in seconds
- 🔴 **Reminder fires on rep's phone** — push notification with lead name, number, and last note; one-tap call
- 🔴 **Overdue follow-ups visible to managers** — overdue list, reassign or check in
- 🔴 **No-idle-lead enforcement** — every lead must have an active follow-up, be overdue-flagged, or carry a final outcome (status)
- ✅ **Activity timeline** per lead (`ActivityTimeline.tsx`, `AddActivityModal.tsx`)

---

## 5. Call & Communication (Mobile-First)

Everything the rep needs is one tap from the field.

- 🔴 **Tap-to-call** from the lead screen
- 🔴 **Automatic call logging** — time, duration captured automatically
- 🟡 **Add note after call** (activities exist) — surface inline on call screen
- 🔴 **Call recording** (for training) + **call volume tracking**
- 🟡 **Send WhatsApp from lead screen** — WhatsApp module exists; add one-tap from lead
- 🔴 **WhatsApp automation campaigns** — welcome msg, monthly market updates, festival greetings, new-property recommendations, buyer education, success stories

---

## 6. Site Visit Management

- 🟡 **Site visit scheduling** (`site_visits` table, mobile site-visit flow exist)
- 🔴 **Pre-visit details** sent to client (location, project info)
- 🔴 **Day-of reminder** with live location
- 🟡 **GPS check-in** (mobile attendance/site-visit GPS exists) — link to visit record
- 🔴 **Post-visit feedback** capture + auto follow-up property suggestions

---

## 7. Lead Scoring & Qualification

- ✅ **0–100 lead scoring** (`lib/leads/scoring.ts`, `ScoreBadge.tsx`)
- ✅ **Temperature** auto-synced from score (hot/warm/cold) (`TemperatureBadge.tsx`)
- ✅ **Duplicate detection** (`DuplicateAlert.tsx`, pg_trgm fuzzy match)
- ✅ **Bulk actions** (`BulkActionsBar.tsx`)

---

## 8. Property Portfolio Tools

- 🟡 **Inventory / projects / plots** exist (inventory module)
- 🔴 **Shareable property albums** — photos, floor plans, location maps + BHK, size, amenities, nearby schools, price, payment plan, move-in date, branding
- 🔴 **Property view analytics** — track which properties get viewed; sort by project / budget / area / type

---

## 9. Reporting & Analytics

Manager sees the full picture in real time — no status-update calls needed.

- 🟡 **Sales & lead reports** exist (`reports/sales`, `reports/leads`)
- 🔴 **Source breakdown** — which source converts best
- 🔴 **Conversion by rep** + **performance rankings**
- 🔴 **Average response time** (per rep)
- 🔴 **Pipeline status** by stage (live)
- 🔴 **Win/loss reasons** — why leads closed and exactly why others didn't
- 🔴 **Monthly / weekly breakdowns**
- 🔴 **Property popularity metrics**

---

## 10. Team Management

- 🟡 **Team module** exists
- 🔴 **Monthly sales targets** per rep
- 🔴 **Area assignments**
- 🔴 **Commission calculations**
- 🔴 **Daily scorecards / performance rankings**

---

## 11. Mobile Capabilities

- ✅ **Mobile app** (Expo, OTP login, dashboard, leads, attendance GPS, notifications)
- 🔴 **Offline / works without internet**, auto-sync
- 🟡 **Push notifications** (notifications table + `action_url` exist) — wire follow-up reminders

---

## Build Priority (suggested)

1. **Follow-up reminders + overdue manager view** — highest-leverage, the system's whole pitch (§4)
2. **Lead capture connectors** — 99acres/MagicBricks, JustDial, IndiaMart, generic webhook (§1)
3. **Auto-assignment rule types** — area/type/budget/source (§2)
4. **Real-estate stage alignment + smart lists** (§3)
5. **Mobile tap-to-call + auto call logging + WhatsApp** (§5)
6. **Source & rep conversion reporting** (§9)
