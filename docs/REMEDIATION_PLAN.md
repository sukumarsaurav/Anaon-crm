# ANON INDIA CRM — Functional Remediation Plan

**Author:** Senior full-stack audit
**Date:** 2026-06-18
**Scope:** Close the "built but not wired" integration gaps + high-impact sales-ops depth.
**Decisions locked:** SMS = **MSG91** (DLT-compliant, India) · Payments = **Razorpay** · Email = **Resend** · Push = **Expo + web-push**.

---

## 1. Depth-audit findings (verified against code)

The CRM is broad (18 modules, ~90 routes, full data model + UI). The gaps are **last-mile integrations**, not missing screens.

| # | Area | Status | Evidence |
|---|------|--------|----------|
| 1 | Razorpay payments | **Not integrated** — no SDK, no order-create, no webhook. `razorpay_*` are dead columns. `recordPayment` is manual reconciliation only. | `crm/src/lib/clients/actions.ts:126`, `package.json` |
| 2 | Portal OTP login | **Broken in prod** — OTP generated/hashed correctly, but the send step is a no-op (`// In production: send OTP via WhatsApp / SMS here`). Code only returned when `NODE_ENV==='development'`. | `crm/src/lib/portal/actions.ts:34-36` |
| 3 | Email | **Absent entirely** — no nodemailer/Resend/SendGrid. | dependency scan |
| 4 | Letters (allotment/demand/cost-sheet) | HTML print pages only (`window.print`); **no PDF artifact** to store/attach/email. | `crm/src/app/(dashboard)/bookings/[id]/allotment-letter/page.tsx` |
| 5 | Push notifications | In-app only. `notifications` rows created in 5 places, surfaced via realtime `NotificationBell` (realtime works ✅), but **no FCM/Expo/web-push delivery**. | `crm/src/components/layout/NotificationBell.tsx`, cron routes |
| 6 | WhatsApp | **Real & wired** — Meta Cloud API, used by chatbot/auto-reply/actions, webhook HMAC verify present. **Reuse as delivery rail.** | `crm/src/lib/whatsapp/provider.ts:69-164` |
| 7 | e-sign (Digio) | Absent (spec'd but not built). | grep |

**Leverage point:** WhatsApp Cloud API is the one channel that already works — it becomes the delivery rail for OTP *and* notifications, collapsing three problems into one.

---

## 2. Guiding principles

- **Reuse existing paths:** the automation engine already fires `payment_received`, `complaint_raised`, etc. — new channels (email/push) become new *action types*, not parallel systems.
- **Idempotency everywhere:** all webhooks must verify signature + dedupe on a provider id so retries don't double-insert. Build once in `lib/webhooks/idempotency.ts`.
- **Next 16 discipline:** new route handlers `await params`; every public/webhook route MUST be added to `PUBLIC_PATHS` in `crm/src/proxy.ts` or it 307s to `/login`. Check `node_modules/next/dist/docs/` before writing route code (per `AGENTS.md`).
- **Secrets:** new keys added to both Vercel projects + `.env.local`; documented in `DEPLOYMENT.md`.

---

## 3. Phased plan

Effort = rough dev-days, one senior dev. **Order: R0 → R1 → R2.**

### Phase R0 — Unblock money & login (P0, ~4–5d)

#### R0.1 Razorpay payment collection (2.5d)
- Add `razorpay` SDK + `crm/src/lib/payments/razorpay.ts` (order create, signature verify).
- `POST /api/payments/razorpay/order` — create order for a `payments` row, persist `razorpay_order_id`.
- `POST /api/webhooks/razorpay` — HMAC-verify `X-Razorpay-Signature`; idempotent on `razorpay_payment_id`; set `payments.status='paid'`, `verified_at`; fire `payment_received` (reuse `clients/actions.ts:154`). Add route to `PUBLIC_PATHS`.
- Client-portal **"Pay Now"** → Razorpay Checkout on the payments page.
- Manual `recordPayment` stays for offline (cheque/cash).
- **Env:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
- **Accept:** online pay → webhook marks paid → receipt automation fires; no manual entry.

#### R0.2 Real OTP delivery (1.5d)
- `crm/src/lib/messaging/otp.ts` — provider switch: WhatsApp template (primary) + MSG91 SMS (fallback).
- Replace the no-op at `portal/actions.ts:34`; **remove `otp` from the return value entirely** (log server-side instead) — kills the network-tab leak.
- Same rail for mobile-app login OTP.
- **Env:** `MSG91_AUTH_KEY`, `MSG91_OTP_TEMPLATE_ID`, `WHATSAPP_OTP_TEMPLATE_NAME`.
- **Accept:** prod login receives OTP via WhatsApp/SMS; code never in HTTP response.

### Phase R1 — Delivery rails: email, PDF, push (P0/P1, ~5d)

#### R1.2 PDF generation (2d) — *build first, blocks R1.1 letter-emails*
- Convert allotment/demand/cost-sheet print pages to server-rendered PDF (`@react-pdf/renderer` or headless-chrome route).
- Store in Supabase Storage; attach to emails; expose download in client portal.

#### R1.1 Transactional email (1.5d)
- Resend + `crm/src/lib/email/` typed senders.
- New `email` action type in the automation engine (alongside whatsapp).
- Wire: booking confirmation, payment receipt (with PDF), demand letter, KYC-status change.
- **Env:** `RESEND_API_KEY`, `EMAIL_FROM`.

#### R1.3 Push notifications (1.5d)
- `notify()` helper called by every existing `notifications` insert site; fans out to **Expo push** (add `push_tokens` table) + **web-push**.
- Wraps — does not replace — the working in-app realtime bell.
- **Env:** `EXPO_ACCESS_TOKEN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.

### Phase R2 — Sales-ops depth (P1, ~5–6d) — internal-only, do after integrations

- **Lead merge UI (1.5d)** — surface pg_trgm dedup as "possible duplicates" panel + merge (re-parent `lead_activities`/`site_visits`, keep higher-score record).
- **Bulk lead actions (1.5d)** — multi-select → bulk reassign / stage-change / WhatsApp-broadcast.
- **Global search / command palette (1d)** — `cmdk`, cross-entity (leads/clients/projects/bookings); `TopBar.tsx` already gestures at it.
- **Click-to-call + call logging (2d)** — Exotel/Servetel click-to-call from lead detail; call webhook → auto `lead_activities` entry + recording URL. (The one explicitly-unshipped spec phase.)

---

## 4. Cross-cutting hardening (fold into R0/R1)

- `lib/webhooks/idempotency.ts` — shared signature-verify + dedupe; apply to Razorpay, Meta leads, WhatsApp.
- Confirm a cron actually calls `release_expired_holds()` (else soft-holds never release).
- Audit the ~236 `TODO/placeholder/mock` hits in `crm/src` for shipped-with-fake-data screens.

---

## 5. Sequencing & estimate

| Phase | Items | Days | Depends on |
|-------|-------|------|-----------|
| R0.1 | Razorpay | 2.5 | — |
| R0.2 | OTP delivery | 1.5 | — (parallel w/ R0.1) |
| R1.2 | PDF | 2.0 | — |
| R1.1 | Email | 1.5 | R1.2 |
| R1.3 | Push | 1.5 | — |
| R2 | Sales-ops depth | 5–6 | R0/R1 |
| | **Total** | **~14–16** | |

---

## 6. Env vars to provision (both Vercel projects + `.env.local`)

```
# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
# MSG91 (SMS/OTP)
MSG91_AUTH_KEY=
MSG91_OTP_TEMPLATE_ID=
WHATSAPP_OTP_TEMPLATE_NAME=
# Resend (email)
RESEND_API_KEY=
EMAIL_FROM=
# Push
EXPO_ACCESS_TOKEN=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```
