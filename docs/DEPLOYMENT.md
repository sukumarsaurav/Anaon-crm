# Deployment Architecture

ANON INDIA runs as **two separate Next.js apps + one mobile app**, all sharing a single Supabase backend (project `dfjyslxrzniqtlniseat`).

```
                         ┌─────────────────────────┐
   anonindia.com  ─────▶ │  website/   (marketing)  │ ─┐
                         └─────────────────────────┘  │
                                                       ├──▶  Supabase (shared DB/Auth/Storage)
            dashboard.anonindia.com ─┐                 │
                                     ▼                 │
                         ┌─────────────────────────┐  │
                         │  crm/   (admin + CRM)    │ ─┘
                         └─────────────────────────┘
                                     ▲
                          mobile/ (Expo) ─ Bearer-token APIs under crm /api/mobile/*
```

- **`website/`** — public marketing site (Projects, Blog, Gallery, Careers, Contact). Lead forms write to Supabase. Served at the **apex domain** `anonindia.com`.
- **`crm/`** — the dashboard **and** the admin panel. Manages leads/inventory/bookings *and* public-site content (blog, projects, careers CMS). Served at **`dashboard.anonindia.com`**.
- **`mobile/`** — Expo app, talks to the CRM's `/api/mobile/*` endpoints.

There is **no separate admin app** — the CRM is the admin. The website is read-mostly and is edited from the CRM.

## Vercel: two projects

Create two Vercel projects from the same repo, each with a different **Root Directory**:

| Project | Root Directory | Production Domain |
|---|---|---|
| `anonindia-website` | `website` | `anonindia.com`, `www.anonindia.com` |
| `anonindia-crm` | `crm` | `dashboard.anonindia.com` |

### DNS (at your registrar)
- `A` / `ALIAS` `anonindia.com` → Vercel (apex)
- `CNAME` `www` → `cname.vercel-dns.com`
- `CNAME` `dashboard` → `cname.vercel-dns.com`

Add each domain in the corresponding Vercel project's **Settings → Domains**.

## Environment variables

### `website` project
```
NEXT_PUBLIC_SUPABASE_URL=https://dfjyslxrzniqtlniseat.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
NEXT_PUBLIC_SITE_URL=https://anonindia.com
NEXT_PUBLIC_DASHBOARD_URL=https://dashboard.anonindia.com   # "Agent Login" link target
NEXT_PUBLIC_WHATSAPP_NUMBER=+91XXXXXXXXXX
```

### `crm` project
```
NEXT_PUBLIC_SUPABASE_URL=https://dfjyslxrzniqtlniseat.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
NEXT_PUBLIC_APP_URL=https://dashboard.anonindia.com         # absolute webhook URLs
NEXT_PUBLIC_WEBSITE_URL=https://anonindia.com               # logout → public website
CRON_SECRET=<random secret>                                  # see Cron below
LEAD_WEBHOOK_SECRET=<random secret>                          # lead capture webhooks
META_WEBHOOK_VERIFY_TOKEN=<token>                            # if using Meta lead ads
META_PAGE_ACCESS_TOKEN=<token>
```

Generate secrets with `openssl rand -hex 24`.

## Cron jobs (scheduler)

**Vercel Hobby allows only one run/day per cron** — sub-daily expressions fail
deployment. So `crm/vercel.json` keeps a once-daily baseline (Hobby-compliant):

| Path | Vercel schedule (UTC) | IST | Purpose |
|---|---|---|---|
| `/api/cron/site-visit-reminders` | `30 1 * * *` | ~07:00 | Day-of site-visit reminders |
| `/api/cron/followup-reminders` | `30 3 * * *` | ~09:00 | Due/overdue follow-up reminders |
| `/api/cron/automations` | `0 2 * * *` | ~07:30 | Time-based automations (payments, birthdays) |

Vercel auto-sends `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set.
All routes accept GET (Vercel) and POST (external). `pg_cron` is **not** enabled.

### Restoring frequent execution (free, no Pro plan)

`.github/workflows/cron.yml` (GitHub Actions, free) hits `followup-reminders` +
`automations` **every 15 minutes**, so reminders stay timely without upgrading.
The cron routes are idempotent, so overlapping with the daily Vercel run is safe.

Add two **repo secrets** (Settings → Secrets and variables → Actions) to enable it:

| Secret | Value |
|---|---|
| `CRON_BASE_URL` | deployed CRM URL, e.g. `https://dashboard.anonindia.com` (no trailing slash) |
| `CRON_SECRET` | same value as the Vercel env var |

> Note: GitHub Actions schedules can be delayed a few minutes under load and are
> auto-disabled after 60 days of repo inactivity — fine for this use, and still
> more frequent than Hobby's daily limit. Upgrading to Vercel Pro lets you move
> the schedules back into `vercel.json` and delete the workflow.

## Lead capture webhooks

After deploy, the CRM **Settings → Integrations** page shows ready-to-paste webhook URLs per portal, e.g.:
```
https://dashboard.anonindia.com/api/webhooks/leads/99acres?token=<LEAD_WEBHOOK_SECRET>
```
Paste each into the corresponding portal (99acres, MagicBricks, JustDial, IndiaMart, …).

## Auth note

The two apps are independent deployments. CRM auth (Supabase + 2FA + IP allowlist via `crm/src/proxy.ts`) is fully self-contained on `dashboard.anonindia.com`; the website does not share its session. No cross-subdomain cookie config is required.

## Phase R0/R1 integrations (payments, OTP, email, PDF, push)

Set these in **both** the CRM env (`crm/.env.local` + Vercel) unless noted. All are blank by default; features degrade gracefully (no-op + server log) until configured.

| Env var | Used by | Notes |
|---|---|---|
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Online payments | Razorpay API keys |
| `RAZORPAY_WEBHOOK_SECRET` | Payment webhook | Must match the secret on the Razorpay webhook |
| `WHATSAPP_OTP_TEMPLATE_NAME` | OTP (primary) | Approved WhatsApp template, one `{{1}}` = OTP (default `otp_login`) |
| `MSG91_AUTH_KEY` / `MSG91_OTP_TEMPLATE_ID` / `MSG91_SENDER_ID` | OTP (SMS fallback) | MSG91 DLT flow template with an `OTP` variable |
| `RESEND_API_KEY` / `EMAIL_FROM` | Transactional email | Verified Resend sender |
| `EXPO_ACCESS_TOKEN` | Mobile push | Optional Expo push security token |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web push | Generate with `npx web-push generate-vapid-keys` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web push (browser) | Same value as `VAPID_PUBLIC_KEY` |

### Razorpay webhook
Razorpay Dashboard → Webhooks → add `https://dashboard.anonindia.com/api/webhooks/razorpay`, event **`payment.captured`**, secret = `RAZORPAY_WEBHOOK_SECRET`. This webhook is the source of truth for marking installments paid (it also emails the PDF receipt).

### Storage
PDFs (receipts/allotment/demand letters) are written to a private Supabase Storage bucket `documents`, auto-created on first use. Download routes return them behind auth (`/api/documents/*` for staff, `/api/portal/receipt/*` for clients).

### Push
The browser service worker is `crm/public/sw.js`; users opt in via the "Enable alerts" control in the top bar. The mobile (Expo) app registers its token at `POST /api/push/register`. All in-app notifications now fan out to push via `lib/notifications/notify.ts`.

## Phase R2 — click-to-call (Exotel)

| Env var | Notes |
|---|---|
| `EXOTEL_SID` / `EXOTEL_API_KEY` / `EXOTEL_API_TOKEN` | Exotel account credentials |
| `EXOTEL_CALLER_ID` | Your ExoPhone (the number shown to leads) |
| `EXOTEL_SUBDOMAIN` | `api.exotel.com` (default) or `api.in.exotel.com` |

Click-to-call from a lead detail rings the agent (their `profiles.phone`) first, then dials the lead. Set the Exotel **StatusCallback** / passthru to `https://dashboard.anonindia.com/api/webhooks/exotel` — it records call duration + recording URL on the lead timeline (and logs inbound calls by matching the caller's phone to a lead). Recording requires `Record=true` to be permitted on the ExoPhone.
