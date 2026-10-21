-- Core CRM audit (docs/CORE_CRM_AUDIT_2026-10-21.md): L4 lead column guard, L4 activity forgery, B2 pending-booking hold.

-- ── L4: leads column guard ───────────────────────────────────────────────────
-- leads_update_hierarchy has no WITH CHECK and there was no guard trigger, so an advisor could set
-- their own lead to closed_won (no booking), soft-delete it (admin-only in the app) or rewrite
-- created_by / duplicate flags straight through the API. Managers, admins and server sessions pass.
create or replace function public.leads_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if public.current_session_is_privileged() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.stage = 'closed_won' or new.is_active is false or coalesce(new.is_duplicate, false) then
      raise exception 'A new lead must start open' using errcode = '42501';
    end if;
    return new;
  end if;
  if (new.stage = 'closed_won') is distinct from (old.stage = 'closed_won') then
    raise exception 'Closed Won is set when a booking is approved' using errcode = '42501';
  end if;
  if new.is_active is distinct from old.is_active then
    raise exception 'Only an admin can delete or restore a lead' using errcode = '42501';
  end if;
  if new.created_by is distinct from old.created_by
     or new.is_duplicate is distinct from old.is_duplicate
     or new.duplicate_of is distinct from old.duplicate_of then
    raise exception 'Only a manager can change who created a lead or merge it' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_guard on public.leads;
create trigger trg_leads_guard
  before insert or update on public.leads
  for each row execute function public.leads_guard();

-- ── L4: timeline entries in your own name, on leads you can see ─────────────
-- Any staff member could insert an activity on any lead with any performed_by (e.g. the admin's).
-- Every user-session insert in the app writes the caller's id; server paths use the service role.
drop policy if exists lead_activities_insert_staff on public.lead_activities;
create policy lead_activities_insert_staff on public.lead_activities
  for insert to authenticated
  with check (
    public.current_user_is_staff()
    and performed_by = (select auth.uid())
    and exists (select 1 from public.leads l where l.id = lead_id)  -- RLS on leads: visible to the caller
  );

-- ── B2: a hold that backs a pending booking stays put ───────────────────────
-- createBooking holds the plot in the advisor's name; plots_guard let that advisor release it while
-- the booking waited, so the plot looked free and someone else could hold it.
create or replace function public.plot_has_pending_booking(p_plot_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.bookings where plot_id = p_plot_id and status = 'pending_approval');
$$;
revoke all on function public.plot_has_pending_booking(uuid) from public, anon;
grant execute on function public.plot_has_pending_booking(uuid) to authenticated;

create or replace function public.plots_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  ignored constant text[] := array['status', 'held_by', 'held_until', 'updated_at', 'total_price'];
begin
  if public.current_session_is_privileged() then
    return new;
  end if;
  if (to_jsonb(new) - ignored) is distinct from (to_jsonb(old) - ignored) then
    raise exception 'Only a manager can edit plot details or prices' using errcode = '42501';
  end if;
  if new.status = 'soft_hold' then
    if new.held_by is distinct from auth.uid() then
      raise exception 'A hold must be in your own name' using errcode = '42501';
    end if;
    if not (old.status = 'available' or (old.status = 'soft_hold' and old.held_by = auth.uid())) then
      raise exception 'This plot is not available' using errcode = '42501';
    end if;
  elsif new.status = 'available' then
    if not (old.status = 'available' or (old.status = 'soft_hold' and old.held_by = auth.uid())) then
      raise exception 'You can only release your own hold' using errcode = '42501';
    end if;
    if old.status = 'soft_hold' and public.plot_has_pending_booking(old.id) then
      raise exception 'This plot has a booking waiting for approval — a manager must reject it to free the plot' using errcode = '42501';
    end if;
  elsif new.status is distinct from old.status then
    raise exception 'Only a manager can change a plot to %', new.status using errcode = '42501';
  end if;
  return new;
end;
$$;
