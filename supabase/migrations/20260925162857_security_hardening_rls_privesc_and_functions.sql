-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Privilege escalation: freeze privileged columns on self-update
--
-- profiles_update_own lets a user update their own row but has no WITH CHECK,
-- and no trigger guarded `role`, so any user could PATCH their own row to
-- role='admin'. This trigger rejects changes to privileged columns when the
-- session is editing its OWN row. Service-role calls (auth.uid() IS NULL, used
-- by login bookkeeping and 2FA enrolment) and admins editing OTHER users'
-- rows (auth.uid() <> id) pass through unaffected.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.profiles_freeze_privileged_self()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id then
    if new.role                 is distinct from old.role
    or new.is_active            is distinct from old.is_active
    or new.branch_id            is distinct from old.branch_id
    or new.reporting_manager_id is distinct from old.reporting_manager_id
    or new.failed_login_count   is distinct from old.failed_login_count
    or new.lockout_until        is distinct from old.lockout_until
    or new.last_failed_login_at is distinct from old.last_failed_login_at
    or new.two_factor_enabled   is distinct from old.two_factor_enabled
    or new.two_factor_secret    is distinct from old.two_factor_secret
    then
      raise exception 'Not allowed to modify privileged profile fields on your own account'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_freeze_privileged_self on public.profiles;
create trigger trg_profiles_freeze_privileged_self
  before update on public.profiles
  for each row execute function public.profiles_freeze_privileged_self();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Admin tables mislabeled "Service role manages …" but bound to authenticated
--    with USING(true): any signed-in user could read AND write them. Writes in
--    the app go through the service-role client (BYPASSRLS), so removing
--    authenticated write access breaks nothing; only the reads the app makes as
--    the signed-in user need policies.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "Service role manages security_settings" on public.security_settings;
create policy "security_settings_read_authenticated" on public.security_settings
  for select to authenticated using (true);

drop policy if exists "Service role manages ip_whitelist" on public.ip_whitelist;
create policy "ip_whitelist_read_authenticated" on public.ip_whitelist
  for select to authenticated using (true);

drop policy if exists "Service role manages user_sessions" on public.user_sessions;
create policy "user_sessions_read_own_or_admin" on public.user_sessions
  for select to authenticated
  using (user_id = (select auth.uid()) or public.current_user_is_admin_or_manager());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Financial / PII tables: every signed-in user could read all rows. The
--    team_read_* policies were stubs — auth.uid() IN (all active profiles) —
--    true for everyone and never referencing the hierarchy. Replace them, and
--    drop the blanket *_read_authenticated policies, with predicates scoped
--    through current_user_visible_members(): admins see all, team leaders their
--    subtree, everyone else only records they own.
--    (Write policies for these tables are hardened in the next migration.)
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "bookings_read_authenticated" on public.bookings;
drop policy if exists "team_read_bookings" on public.bookings;
create policy "bookings_read_scoped" on public.bookings
  for select to authenticated
  using (
    advisor_id  in (select public.current_user_visible_members())
    or manager_id in (select public.current_user_visible_members())
    or created_by in (select public.current_user_visible_members())
  );

drop policy if exists "clients_read_authenticated" on public.clients;
drop policy if exists "team_read_clients" on public.clients;
create policy "clients_read_scoped" on public.clients
  for select to authenticated
  using (
    created_by in (select public.current_user_visible_members())
    or id in (
      select b.client_id from public.bookings b
      where b.advisor_id  in (select public.current_user_visible_members())
         or b.manager_id  in (select public.current_user_visible_members())
         or b.created_by  in (select public.current_user_visible_members())
    )
  );

drop policy if exists "payments_read_authenticated" on public.payments;
drop policy if exists "team_read_payments" on public.payments;
create policy "payments_read_scoped" on public.payments
  for select to authenticated
  using (
    booking_id in (
      select b.id from public.bookings b
      where b.advisor_id  in (select public.current_user_visible_members())
         or b.manager_id  in (select public.current_user_visible_members())
         or b.created_by  in (select public.current_user_visible_members())
    )
  );

drop policy if exists "client_documents_read_authenticated" on public.client_documents;
drop policy if exists "team_read_client_docs" on public.client_documents;
create policy "client_documents_read_scoped" on public.client_documents
  for select to authenticated
  using (
    uploaded_by in (select public.current_user_visible_members())
    or client_id in (
      select c.id from public.clients c
      where c.created_by in (select public.current_user_visible_members())
    )
  );

drop policy if exists "brokers_read_authenticated" on public.brokers;
drop policy if exists "team_read_brokers" on public.brokers;
create policy "brokers_read_scoped" on public.brokers
  for select to authenticated
  using (
    public.current_user_is_admin_or_manager()
    or invited_by  in (select public.current_user_visible_members())
    or approved_by in (select public.current_user_visible_members())
  );

drop policy if exists "broker_commissions_read_authenticated" on public.broker_commissions;
drop policy if exists "team_read_commissions" on public.broker_commissions;
create policy "broker_commissions_read_scoped" on public.broker_commissions
  for select to authenticated
  using (
    public.current_user_is_admin_or_manager()
    or booking_id in (
      select b.id from public.bookings b
      where b.advisor_id in (select public.current_user_visible_members())
         or b.created_by in (select public.current_user_visible_members())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Pin search_path on the remaining flagged functions.
-- ─────────────────────────────────────────────────────────────────────────────
alter function public.update_updated_at_column() set search_path = public, pg_temp;
alter function public.release_expired_holds()      set search_path = public, pg_temp;
alter function public.sync_lead_temperature()      set search_path = public, pg_temp;
alter function public.update_updated_at()          set search_path = public, pg_temp;
alter function public.teams_prevent_cycle()        set search_path = public, pg_temp;
alter function public.write_audit_log(uuid, text, text, uuid, jsonb, jsonb, inet, text, jsonb)
  set search_path = public, pg_temp;
