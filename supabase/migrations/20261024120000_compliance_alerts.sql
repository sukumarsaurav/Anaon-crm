-- Phase E (docs/OPERATIONS_FEATURES_PLAN_2026-10-21.md): RERA expiry / quarterly-report alerts.

-- One row per alert ever sent, so the daily cron never repeats one. `threshold` includes the date it
-- is about (e.g. "2027-04-14:30"), so renewing a registration starts a fresh set of reminders.
create table if not exists public.compliance_alerts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('rera_expiry', 'quarterly_report', 'missing_documents')),
  threshold text not null,
  message text not null,
  sent_at timestamptz not null default now(),
  unique (project_id, kind, threshold)
);

alter table public.compliance_alerts enable row level security;

-- Written by the cron (service role). Admins and managers can read the history.
create policy compliance_alerts_read on public.compliance_alerts for select to authenticated
  using ((select public.current_user_is_admin_or_manager()));

create index if not exists compliance_alerts_project_idx on public.compliance_alerts (project_id, sent_at desc);

-- Where the legal contact gets the daily digest (legal_contact stays free text: name and phone).
alter table public.projects add column if not exists legal_contact_email text;
