-- A1 SLA clock: when did the lead enter its current stage? (SLA ran from created_at, so every older lead looked breached.)
alter table public.leads add column if not exists stage_changed_at timestamptz;
update public.leads l set stage_changed_at = coalesce(
  (select max(a.created_at) from public.lead_activities a where a.lead_id = l.id and a.type = 'stage_change' and a.stage_to::text = l.stage::text),
  l.created_at)
where stage_changed_at is null;
alter table public.leads alter column stage_changed_at set default now();

create or replace function public.leads_touch_stage_changed_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    new.stage_changed_at := coalesce(new.stage_changed_at, now());
  elsif new.stage is distinct from old.stage then
    new.stage_changed_at := now();
  end if;
  return new;
end $$;
drop trigger if exists leads_stage_changed_at on public.leads;
create trigger leads_stage_changed_at before insert or update of stage on public.leads
  for each row execute function public.leads_touch_stage_changed_at();

-- A4 booking numbers: sequential (BKG-<year>-NNN, continuing after the 3 existing) instead of random 5 digits that could collide.
create sequence if not exists public.booking_number_seq start 4;
alter table public.bookings alter column booking_number
  set default ('BKG-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.booking_number_seq')::text, 3, '0'));

-- A5 template names: WhatsApp allows one template per (name, language). Two drafts duplicated approved ones.
update public.whatsapp_templates set name = name || '_draft' where status = 'draft' and name in ('payment_reminder', 'site_visit_confirmation');
create unique index if not exists whatsapp_templates_name_language_key on public.whatsapp_templates (name, language);

-- A6 campaigns: one utm_campaign per campaign, or their leads and spend merge in the ROI reports.
update public.marketing_campaigns set utm_campaign = 'anon_heights_instagram' where id = '44444444-0001-0001-0001-000000000005' and utm_campaign = 'jaipur_plots_q1';
create unique index if not exists marketing_campaigns_utm_campaign_key on public.marketing_campaigns (utm_campaign) where utm_campaign is not null;

-- A10 sessions: purge old rows daily (they were never removed: 21 and counting).
create or replace function public.purge_old_sessions()
returns void language sql set search_path = public, pg_temp as $$
  delete from user_sessions where coalesce(last_active_at, created_at) < now() - interval '30 days';
$$;
revoke all on function public.purge_old_sessions() from public, anon, authenticated;
select cron.schedule('purge-old-user-sessions', '15 3 * * *', $c$select public.purge_old_sessions()$c$);

-- C test-data clean-up: plots marked booked with no booking, and holds with neither an expiry nor a pending booking
update public.plots p set status = 'available', booked_by_client_id = null, booking_date = null, held_by = null, held_until = null
where p.status = 'booked' and not exists (select 1 from public.bookings b where b.plot_id = p.id and b.status = 'confirmed');
update public.plots p set status = 'available', held_by = null, held_until = null
where p.status = 'soft_hold' and p.held_until is null and not exists (select 1 from public.bookings b where b.plot_id = p.id and b.status = 'pending_approval');
