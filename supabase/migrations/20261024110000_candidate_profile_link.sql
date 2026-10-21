-- Phase B (docs/OPERATIONS_FEATURES_PLAN_2026-10-21.md): a joined candidate links to the staff
-- profile created for them, once.

alter table public.career_applications
  add column if not exists profile_id uuid references public.profiles(id) on delete set null;

create unique index if not exists career_applications_profile_id_key
  on public.career_applications (profile_id) where profile_id is not null;

-- The public form must not be able to set the link either.
drop policy if exists career_applications_public_insert on public.career_applications;
create policy career_applications_public_insert on public.career_applications for insert to anon, authenticated with check (
  stage = 'applied'
  and profile_id is null
  and reviewed_by is null and reviewed_at is null
  and interview_date is null and interviewer_id is null and interview_rating is null and interview_feedback is null
  and offer_ctc is null and offer_date is null and joining_date is null and rejection_reason is null
);
