-- Phase G (docs/OPERATIONS_FEATURES_PLAN_2026-10-21.md): applications from the website reach the CRM.

alter table public.career_applications
  add column if not exists source text not null default 'manual',
  add column if not exists cv_consent_at timestamptz;   -- DPDP: when the applicant agreed to us keeping their CV

create index if not exists career_applications_phone_created_idx on public.career_applications (phone, created_at desc);
