-- Menu audit 2026-10-20, phase 1.
--
-- The bookings / payments / clients policies are ALL-command and scoped to the user's hierarchy, so a
-- sales advisor could, straight through the REST API, confirm their own booking and mark installments
-- paid. plots_update let any staff member rewrite any column (price included). The server actions
-- check roles, but the browser holds a JWT and can skip them.
--
-- Column-level rules are enforced with BEFORE triggers rather than more policies: reads and the
-- legitimate advisor writes keep working, and only the privileged columns are frozen below manager.
-- The service role (webhooks, crons, portal) and direct database sessions pass.

-- Who may change privileged columns: admins/managers, the service role, and DB-side jobs (no JWT).
create or replace function public.current_session_is_privileged()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  claims text := current_setting('request.jwt.claims', true);
begin
  if claims is null or claims = '' then
    return true; -- pg_cron, migrations, SQL editor
  end if;
  if coalesce(claims::json ->> 'role', '') = 'service_role' then
    return true;
  end if;
  return public.current_user_is_admin_or_manager();
end;
$$;

revoke all on function public.current_session_is_privileged() from public;
grant execute on function public.current_session_is_privileged() to authenticated, anon, service_role;

-- ── bookings ────────────────────────────────────────────────────────────────
-- Below manager: insert only as pending_approval with no approval fields; never update; delete only
-- your own still-pending booking (createBooking rolls back that way when the plot hold fails).
create or replace function public.bookings_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if public.current_session_is_privileged() then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'pending_approval' or new.approved_by is not null or new.approved_at is not null then
      raise exception 'Only a manager can confirm a booking' using errcode = '42501';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    raise exception 'Only a manager can change a booking' using errcode = '42501';
  else -- DELETE
    if old.status <> 'pending_approval' or old.created_by is distinct from auth.uid() then
      raise exception 'Only a manager can delete a booking' using errcode = '42501';
    end if;
    return old;
  end if;
end;
$$;

drop trigger if exists trg_bookings_guard on public.bookings;
create trigger trg_bookings_guard
  before insert or update or delete on public.bookings
  for each row execute function public.bookings_guard();

-- ── payments ────────────────────────────────────────────────────────────────
-- Installments, receipts and waivers are a manager's job (or Razorpay's, via the service role).
create or replace function public.payments_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if public.current_session_is_privileged() then
    return coalesce(new, old);
  end if;
  raise exception 'Only a manager can change the payment schedule' using errcode = '42501';
end;
$$;

drop trigger if exists trg_payments_guard on public.payments;
create trigger trg_payments_guard
  before insert or update or delete on public.payments
  for each row execute function public.payments_guard();

-- ── clients.kyc_status ──────────────────────────────────────────────────────
create or replace function public.clients_kyc_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.kyc_status is distinct from old.kyc_status and not public.current_session_is_privileged() then
    raise exception 'Only a manager can verify or reject KYC' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clients_kyc_guard on public.clients;
create trigger trg_clients_kyc_guard
  before update on public.clients
  for each row execute function public.clients_kyc_guard();

-- ── plots ───────────────────────────────────────────────────────────────────
-- Below manager only the hold columns may change, and only to take a free plot (or re-take your own
-- hold) or release your own hold. Price, size, booking fields and other people's holds are frozen.
create or replace function public.plots_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  hold_cols constant text[] := array['status', 'held_by', 'held_until', 'updated_at'];
begin
  if public.current_session_is_privileged() then
    return new;
  end if;

  if (to_jsonb(new) - hold_cols) is distinct from (to_jsonb(old) - hold_cols) then
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
  elsif new.status is distinct from old.status then
    raise exception 'Only a manager can change a plot to %', new.status using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_plots_guard on public.plots;
create trigger trg_plots_guard
  before update on public.plots
  for each row execute function public.plots_guard();

-- ── construction_milestones: deleting history is a manager action ──────────
drop policy if exists construction_milestones_delete_staff on public.construction_milestones;
drop policy if exists construction_milestones_delete_mgr on public.construction_milestones;
create policy construction_milestones_delete_mgr on public.construction_milestones
  for delete to authenticated using (public.current_user_is_admin_or_manager());

-- ── price escalations: apply them on their date ─────────────────────────────
-- They were saved and never applied. Unsold plots of the project get the new base price (total_price
-- is generated from it); booked / sold plots keep the price they were sold at.
create or replace function public.apply_due_price_escalations()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  e record;
  n integer := 0;
begin
  for e in
    select id, project_id, percentage_increase
    from price_escalations
    where coalesce(applied, false) = false
      and escalation_date <= (now() at time zone 'Asia/Kolkata')::date
    order by escalation_date, created_at
    for update skip locked
  loop
    update plots
       set base_price          = round(base_price * (1 + e.percentage_increase / 100.0)),
           base_price_per_sqyd = case when base_price_per_sqyd is null then null
                                      else round(base_price_per_sqyd * (1 + e.percentage_increase / 100.0)) end,
           updated_at          = now()
     where project_id = e.project_id
       and status in ('available', 'soft_hold');

    update projects
       set starting_price = case when starting_price is null then null
                                 else round(starting_price * (1 + e.percentage_increase / 100.0)) end,
           price_per_sqft = case when price_per_sqft is null then null
                                 else round(price_per_sqft * (1 + e.percentage_increase / 100.0)) end,
           updated_at     = now()
     where id = e.project_id;

    update price_escalations set applied = true where id = e.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.apply_due_price_escalations() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'apply-price-escalations') then
    perform cron.unschedule('apply-price-escalations');
  end if;
  -- 18:35 UTC = 00:05 IST
  perform cron.schedule('apply-price-escalations', '35 18 * * *', 'select public.apply_due_price_escalations()');
end $$;
