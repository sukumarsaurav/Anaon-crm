-- Operations audit 2026-10-21 (Team, HR, Automation, Legal) — docs/OPERATIONS_AUDIT_2026-10-21.md
--
-- 1. profiles: a user could rewrite their own salary, team, targets and HR fields through the REST API.
-- 2. leave_requests / attendance_logs: owners could insert already-approved leave and backdated
--    "present" days. Managers saw them org-wide while profiles are chain-scoped ("Unknown" names).
-- 3. payroll / leave balances: any manager had ALL, including on their own rows.
-- 4. teams / team_targets: any manager could edit any team or anyone's target.
-- 5. CHECK constraints that no longer matched the code (automation actions, queued-run claim,
--    leave types) — those writes failed every time.
-- 6. career_applications: the public insert accepted any column (stage = 'offer', reviewer, …).

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated, anon, service_role;

-- True for the service role and DB-side jobs (no JWT): the server's own writes.
create or replace function public.current_session_is_server()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  claims text := current_setting('request.jwt.claims', true);
begin
  if claims is null or claims = '' then return true; end if;
  return coalesce(claims::json ->> 'role', '') = 'service_role';
end;
$$;

revoke all on function public.current_session_is_server() from public;
grant execute on function public.current_session_is_server() to authenticated, anon, service_role;

-- ── 1. profiles: self-service columns only ───────────────────────────────────
-- Everything an employee may change about themselves. Salary, team, targets, employment, bank and
-- ID fields are HR's (lib/team/staff.ts, service role). The app itself never updates a profile
-- with the user's own session; this closes the direct-API path.
create or replace function public.profiles_freeze_privileged_self()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  allowed text[] := array['full_name', 'phone', 'photo_url', 'emergency_contact', 'address', 'date_of_birth',
                          'last_active_at', 'updated_at'];
begin
  if public.current_session_is_server() then
    return new;
  end if;
  if auth.uid() is not null and auth.uid() = old.id then
    if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
      raise exception 'You can only change your name, phone, photo, address, date of birth and emergency contact. Ask HR for anything else.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ── 2a. leave_requests ───────────────────────────────────────────────────────
-- Owner: insert only as pending; afterwards only withdraw (pending → cancelled). Nobody approves or
-- rejects their own request. Everything else is a manager's, within their chain (policies below).
create or replace function public.leave_requests_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if public.current_session_is_server() then
    return new;
  end if;

  if new.user_id = auth.uid() then
    if tg_op = 'INSERT' then
      if new.status <> 'pending' or new.reviewed_by is not null or new.reviewed_at is not null then
        raise exception 'A leave request starts as pending' using errcode = '42501';
      end if;
    else
      if old.user_id is distinct from new.user_id then
        raise exception 'Not allowed' using errcode = '42501';
      end if;
      if not (old.status = 'pending' and new.status in ('pending', 'cancelled'))
         or new.leave_type is distinct from old.leave_type
         or new.from_date is distinct from old.from_date
         or new.to_date is distinct from old.to_date
         or new.days_count is distinct from old.days_count
         or new.reviewed_by is distinct from old.reviewed_by
         or new.reviewed_at is distinct from old.reviewed_at
         or new.review_note is distinct from old.review_note then
        raise exception 'You can only withdraw your own pending leave request' using errcode = '42501';
      end if;
    end if;
  elsif tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leave_requests_guard on public.leave_requests;
create trigger trg_leave_requests_guard
  before insert or update on public.leave_requests
  for each row execute function public.leave_requests_guard();

-- ── 2b. attendance_logs ──────────────────────────────────────────────────────
-- Your own row: today only (IST), status 'present' when you create it, check-in once, check-out once.
-- Status / date changes and other days are corrections a manager makes (or an admin on themselves).
create or replace function public.attendance_logs_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if public.current_session_is_server() or public.current_user_is_admin() then
    return new;
  end if;

  if new.user_id = auth.uid() then
    if tg_op = 'INSERT' then
      if new.date <> today or new.status <> 'present' then
        raise exception 'You can only check in for today' using errcode = '42501';
      end if;
    else
      if new.user_id is distinct from old.user_id or new.date is distinct from old.date
         or new.status is distinct from old.status or new.notes is distinct from old.notes
         or old.date <> today then
        raise exception 'Ask your manager to correct attendance' using errcode = '42501';
      end if;
      if old.check_in_at is not null and new.check_in_at is distinct from old.check_in_at then
        raise exception 'You have already checked in today' using errcode = '42501';
      end if;
      if old.check_out_at is not null and new.check_out_at is distinct from old.check_out_at then
        raise exception 'You have already checked out today' using errcode = '42501';
      end if;
    end if;
  elsif tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_attendance_logs_guard on public.attendance_logs;
create trigger trg_attendance_logs_guard
  before insert or update on public.attendance_logs
  for each row execute function public.attendance_logs_guard();

-- Chain-scoped access, the same model as profiles / leads: yourself, admins, and managers for the
-- people in the teams they lead.
drop policy if exists leave_select on public.leave_requests;
drop policy if exists leave_update on public.leave_requests;
create policy leave_select on public.leave_requests for select to authenticated using (
  user_id = (select auth.uid())
  or (select public.current_user_is_admin())
  or ((select public.current_user_is_admin_or_manager()) and user_id in (select public.current_user_visible_members()))
);
create policy leave_update on public.leave_requests for update to authenticated using (
  user_id = (select auth.uid())
  or (select public.current_user_is_admin())
  or ((select public.current_user_is_admin_or_manager()) and user_id in (select public.current_user_visible_members()))
);

drop policy if exists attendance_select on public.attendance_logs;
drop policy if exists attendance_insert on public.attendance_logs;
drop policy if exists attendance_update on public.attendance_logs;
create policy attendance_select on public.attendance_logs for select to authenticated using (
  user_id = (select auth.uid())
  or (select public.current_user_is_admin())
  or ((select public.current_user_is_admin_or_manager()) and user_id in (select public.current_user_visible_members()))
);
create policy attendance_insert on public.attendance_logs for insert to authenticated with check (
  user_id = (select auth.uid())
  or (select public.current_user_is_admin())
  or ((select public.current_user_is_admin_or_manager()) and user_id in (select public.current_user_visible_members()))
);
create policy attendance_update on public.attendance_logs for update to authenticated using (
  user_id = (select auth.uid())
  or (select public.current_user_is_admin())
  or ((select public.current_user_is_admin_or_manager()) and user_id in (select public.current_user_visible_members()))
);

-- ── 3. payroll and leave balances ────────────────────────────────────────────
drop policy if exists payroll_runs_mgr_all on public.payroll_runs;
create policy payroll_runs_admin_all on public.payroll_runs for all to authenticated
  using ((select public.current_user_is_admin())) with check ((select public.current_user_is_admin()));

drop policy if exists payroll_slips_mgr_all on public.payroll_slips;
create policy payroll_slips_admin_all on public.payroll_slips for all to authenticated
  using ((select public.current_user_is_admin())) with check ((select public.current_user_is_admin()));
-- An employee sees their own slip once the run is finalized, plus that run's header. Definer helpers:
-- policies on the two tables that query each other directly would recurse.
create or replace function public.payroll_run_is_completed(p_run uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from payroll_runs where id = p_run and status = 'completed');
$$;
create or replace function public.current_user_has_slip_in_run(p_run uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from payroll_slips where run_id = p_run and user_id = auth.uid());
$$;
revoke all on function public.payroll_run_is_completed(uuid) from public;
revoke all on function public.current_user_has_slip_in_run(uuid) from public;
grant execute on function public.payroll_run_is_completed(uuid) to authenticated, service_role;
grant execute on function public.current_user_has_slip_in_run(uuid) to authenticated, service_role;

drop policy if exists payroll_slips_own_select on public.payroll_slips;
create policy payroll_slips_own_select on public.payroll_slips for select to authenticated using (
  user_id = (select auth.uid()) and public.payroll_run_is_completed(run_id)
);
drop policy if exists payroll_runs_own_select on public.payroll_runs;
create policy payroll_runs_own_select on public.payroll_runs for select to authenticated using (
  status = 'completed' and public.current_user_has_slip_in_run(id)
);

drop policy if exists hr_leave_balances_mgr_all on public.hr_leave_balances;
create policy hr_leave_balances_mgr_select on public.hr_leave_balances for select to authenticated using (
  (select public.current_user_is_admin())
  or ((select public.current_user_is_admin_or_manager()) and user_id in (select public.current_user_visible_members()))
);
create policy hr_leave_balances_mgr_write on public.hr_leave_balances for all to authenticated
  using (
    (select public.current_user_is_admin())
    or ((select public.current_user_is_admin_or_manager()) and user_id <> (select auth.uid())
        and user_id in (select public.current_user_visible_members()))
  )
  with check (
    (select public.current_user_is_admin())
    or ((select public.current_user_is_admin_or_manager()) and user_id <> (select auth.uid())
        and user_id in (select public.current_user_visible_members()))
  );

-- ── 4. teams and targets ─────────────────────────────────────────────────────
-- Structure changes are admin-only; "Add junior" runs on the server with the service role.
drop policy if exists teams_insert_mgr on public.teams;
drop policy if exists teams_update_mgr on public.teams;
drop policy if exists teams_delete_mgr on public.teams;
create policy teams_insert_admin on public.teams for insert to authenticated with check ((select public.current_user_is_admin()));
create policy teams_update_admin on public.teams for update to authenticated
  using ((select public.current_user_is_admin())) with check ((select public.current_user_is_admin()));
create policy teams_delete_admin on public.teams for delete to authenticated using ((select public.current_user_is_admin()));

drop policy if exists team_targets_select on public.team_targets;
drop policy if exists team_targets_insert on public.team_targets;
drop policy if exists team_targets_update on public.team_targets;
create policy team_targets_select on public.team_targets for select to authenticated using (
  user_id = (select auth.uid())
  or (select public.current_user_is_admin())
  or ((select public.current_user_is_admin_or_manager()) and user_id in (select public.current_user_visible_members()))
);
create policy team_targets_insert on public.team_targets for insert to authenticated with check (
  (select public.current_user_is_admin())
  or ((select public.current_user_is_admin_or_manager()) and user_id <> (select auth.uid())
      and user_id in (select public.current_user_visible_members()))
);
create policy team_targets_update on public.team_targets for update to authenticated using (
  (select public.current_user_is_admin())
  or ((select public.current_user_is_admin_or_manager()) and user_id <> (select auth.uid())
      and user_id in (select public.current_user_visible_members()))
);

-- Managers moderate announcements (pin / unpin); deleting stays with the author or an admin.
drop policy if exists announcements_update on public.announcements;
create policy announcements_update on public.announcements for update to authenticated using (
  author_id = (select auth.uid()) or (select public.current_user_is_admin_or_manager())
);

-- ── 5. CHECK constraints that drifted from the code ──────────────────────────
alter table public.automations drop constraint if exists automations_action_type_check;
alter table public.automations add constraint automations_action_type_check check (action_type = any (array[
  'send_whatsapp', 'send_notification', 'create_followup', 'change_lead_stage', 'assign_to_advisor', 'send_email'
]));

alter table public.automation_pending_executions drop constraint if exists automation_pending_executions_status_check;
alter table public.automation_pending_executions add constraint automation_pending_executions_status_check
  check (status = any (array['pending', 'running', 'executed', 'cancelled', 'failed']));

alter table public.leave_requests drop constraint if exists leave_requests_leave_type_check;
alter table public.leave_requests add constraint leave_requests_leave_type_check check (leave_type = any (array[
  'casual', 'sick', 'earned', 'unpaid', 'comp_off', 'maternity', 'paternity'
]));
alter table public.hr_leave_balances drop constraint if exists hr_leave_balances_leave_type_check;
alter table public.hr_leave_balances add constraint hr_leave_balances_leave_type_check check (leave_type = any (array[
  'casual', 'sick', 'earned', 'unpaid', 'comp_off', 'maternity', 'paternity'
]));

-- ── 6. career_applications: public form fields only ─────────────────────────
drop policy if exists "public insert applications" on public.career_applications;
create policy career_applications_public_insert on public.career_applications for insert to anon, authenticated with check (
  stage = 'applied'
  and reviewed_by is null and reviewed_at is null
  and interview_date is null and interviewer_id is null and interview_rating is null and interview_feedback is null
  and offer_ctc is null and offer_date is null and joining_date is null and rejection_reason is null
);
