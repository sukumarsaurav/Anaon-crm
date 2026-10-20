-- Campaign fixes (docs/CAMPAIGN_FIX_PLAN.md).

-- ─────────────────────────────────────────────────────────────────────────────
-- M1  Spend is derived from spend logs, by trigger.
--     Hand-entered spend becomes one 'opening' log, so the first daily log adds to it
--     instead of replacing it.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.campaign_spend_logs
  add column if not exists kind text not null default 'daily' check (kind in ('daily', 'opening'));

insert into public.campaign_spend_logs (campaign_id, log_date, spend, notes, kind)
select c.id, c.start_date, c.spend - coalesce(l.total, 0),
       'Opening balance: spend recorded before daily logging', 'opening'
from public.marketing_campaigns c
left join (select campaign_id, sum(spend) total from public.campaign_spend_logs group by campaign_id) l
  on l.campaign_id = c.id
where c.spend - coalesce(l.total, 0) > 0;

-- One daily row per campaign per date (a second log for the day replaces the first).
create unique index if not exists campaign_spend_logs_daily_key
  on public.campaign_spend_logs (campaign_id, log_date) where kind = 'daily';
create unique index if not exists campaign_spend_logs_opening_key
  on public.campaign_spend_logs (campaign_id) where kind = 'opening';

create or replace function public.sync_campaign_spend()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  ids uuid[] := array_remove(array[
    case when tg_op <> 'INSERT' then old.campaign_id end,
    case when tg_op <> 'DELETE' then new.campaign_id end
  ], null);
begin
  -- Lock first, sum in a second statement: under READ COMMITTED that statement's snapshot
  -- sees a concurrent log that committed while we waited, so totals can't go stale.
  perform 1 from marketing_campaigns where id = any(ids) for update;
  update marketing_campaigns c
     set spend = coalesce((select sum(l.spend) from campaign_spend_logs l where l.campaign_id = c.id), 0),
         updated_at = now()
   where c.id = any(ids);
  return null;
end $$;
revoke all on function public.sync_campaign_spend() from public, anon, authenticated;

drop trigger if exists trg_campaign_spend_sync on public.campaign_spend_logs;
create trigger trg_campaign_spend_sync
  after insert or update or delete on public.campaign_spend_logs
  for each row execute function public.sync_campaign_spend();

-- ─────────────────────────────────────────────────────────────────────────────
-- M3 / M11  Campaign keys, dates, and lead → campaign attribution.
-- ─────────────────────────────────────────────────────────────────────────────
update public.marketing_campaigns
   set utm_campaign     = nullif(btrim(utm_campaign), ''),
       utm_source       = nullif(lower(btrim(utm_source)), ''),
       meta_campaign_id = nullif(btrim(meta_campaign_id), ''),
       meta_adset_id    = nullif(btrim(meta_adset_id), '');

-- utm_campaign unique regardless of case/spaces ("Jaipur_Q1" and "jaipur_q1 " are one tag).
drop index if exists public.marketing_campaigns_utm_campaign_key;
create unique index if not exists marketing_campaigns_utm_campaign_ci_key
  on public.marketing_campaigns (lower(btrim(utm_campaign))) where utm_campaign is not null;
create unique index if not exists marketing_campaigns_meta_campaign_id_key
  on public.marketing_campaigns (meta_campaign_id) where meta_campaign_id is not null;

alter table public.marketing_campaigns drop constraint if exists marketing_campaigns_dates_check;
alter table public.marketing_campaigns
  add constraint marketing_campaigns_dates_check check (end_date is null or end_date >= start_date);
alter table public.marketing_campaigns drop constraint if exists marketing_campaigns_money_check;
alter table public.marketing_campaigns
  add constraint marketing_campaigns_money_check check (coalesce(budget, 0) >= 0);

alter table public.leads
  add column if not exists meta_campaign_id text,
  add column if not exists marketing_campaign_id uuid references public.marketing_campaigns(id) on delete set null;
create index if not exists idx_leads_marketing_campaign_id on public.leads (marketing_campaign_id);
create index if not exists idx_leads_meta_campaign_id on public.leads (meta_campaign_id) where meta_campaign_id is not null;

-- Which campaign a lead belongs to: Meta campaign ID, then utm_campaign, then the campaign
-- name (Meta lead ads carry the ad-manager *name*, not our slug). Case/space-insensitive.
create or replace function public.resolve_marketing_campaign(
  p_meta_campaign_id text, p_utm_campaign text, p_campaign_name text
) returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  with k as (
    select nullif(btrim(p_meta_campaign_id), '') as meta,
           nullif(lower(btrim(p_utm_campaign)), '') as utm,
           nullif(lower(btrim(p_campaign_name)), '') as nm
  )
  select id from (
    select c.id, 1 as rank, c.start_date from marketing_campaigns c, k
     where k.meta is not null and c.meta_campaign_id = k.meta
    union all
    select c.id, 2, c.start_date from marketing_campaigns c, k
     where k.utm is not null and lower(btrim(c.utm_campaign)) = k.utm
    union all
    select c.id, 3, c.start_date from marketing_campaigns c, k
     where lower(btrim(c.name)) in (k.utm, k.nm) or lower(btrim(c.utm_campaign)) = k.nm
  ) m
  order by rank, start_date desc
  limit 1
$$;
revoke all on function public.resolve_marketing_campaign(text, text, text) from public, anon;

create or replace function public.leads_link_marketing_campaign()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if new.marketing_campaign_id is null then
      new.marketing_campaign_id := resolve_marketing_campaign(new.meta_campaign_id, new.utm_campaign, new.campaign_name);
    end if;
  elsif (new.meta_campaign_id, new.utm_campaign, new.campaign_name)
          is distinct from (old.meta_campaign_id, old.utm_campaign, old.campaign_name)
        and new.marketing_campaign_id is not distinct from old.marketing_campaign_id then
    new.marketing_campaign_id := resolve_marketing_campaign(new.meta_campaign_id, new.utm_campaign, new.campaign_name);
  end if;
  return new;
end $$;

drop trigger if exists trg_leads_link_marketing_campaign on public.leads;
create trigger trg_leads_link_marketing_campaign
  before insert or update of meta_campaign_id, utm_campaign, campaign_name, marketing_campaign_id on public.leads
  for each row execute function public.leads_link_marketing_campaign();

-- Creating or editing a campaign picks up the leads that already carry its tag/name/ID.
create or replace function public.marketing_campaign_relink_leads()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update leads l
     set marketing_campaign_id = resolve_marketing_campaign(l.meta_campaign_id, l.utm_campaign, l.campaign_name)
   where l.marketing_campaign_id = new.id
      or (l.marketing_campaign_id is null and (
            (new.meta_campaign_id is not null and l.meta_campaign_id = new.meta_campaign_id)
         or lower(btrim(l.utm_campaign)) in (lower(btrim(new.utm_campaign)), lower(btrim(new.name)))
         or lower(btrim(l.campaign_name)) in (lower(btrim(new.utm_campaign)), lower(btrim(new.name)))
      ));
  return null;
end $$;
revoke all on function public.marketing_campaign_relink_leads() from public, anon, authenticated;

drop trigger if exists trg_marketing_campaign_relink_leads on public.marketing_campaigns;
create trigger trg_marketing_campaign_relink_leads
  after insert or update of name, utm_campaign, meta_campaign_id on public.marketing_campaigns
  for each row execute function public.marketing_campaign_relink_leads();

update public.leads
   set marketing_campaign_id = public.resolve_marketing_campaign(meta_campaign_id, utm_campaign, campaign_name)
 where marketing_campaign_id is null
   and coalesce(meta_campaign_id, utm_campaign, campaign_name) is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- M6 / M7 / M8 / M9  ROI in SQL. security invoker: the caller's RLS still applies.
-- ─────────────────────────────────────────────────────────────────────────────
-- One key per channel, whichever spelling it arrived with.
create or replace function public.marketing_source_key(p text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case k
    when 'facebook_ads' then 'facebook' when 'fb' then 'facebook'
    when 'instagram_ads' then 'instagram' when 'ig' then 'instagram'
    when 'google_ads' then 'google' when 'google_lead_form' then 'google'
    when 'portal99acres' then '99acres'
    when 'website_form' then 'website'
    else k end
  from (select nullif(lower(btrim(p)), '') as k) s
$$;

-- Leads that count for marketing: live, not merged duplicates.
create or replace function public.marketing_leads()
returns table (id uuid, created_at timestamptz, marketing_campaign_id uuid, source_key text,
               orphan_label text, is_paid boolean)
language sql stable security invoker set search_path = public, pg_temp as $$
  select l.id, l.created_at, l.marketing_campaign_id,
         coalesce(marketing_source_key(coalesce(l.utm_source, l.source::text)), 'unknown'),
         case when l.marketing_campaign_id is null then nullif(btrim(coalesce(l.utm_campaign, l.campaign_name)), '') end,
         l.marketing_campaign_id is not null
           or (marketing_source_key(coalesce(l.utm_source, l.source::text)) in ('facebook', 'instagram', 'google', 'youtube')
               and coalesce(l.utm_medium, '') not ilike '%organic%')
  from leads l
  where l.is_active and not coalesce(l.is_duplicate, false)
$$;

-- Per-lead funnel facts inside a window: created in it, ≥1 completed visit in it,
-- confirmed bookings dated in it. A "site visit" is a lead that visited, not a visit row.
create or replace function public.marketing_lead_funnel(p_from date, p_to date)
returns table (id uuid, marketing_campaign_id uuid, source_key text, orphan_label text, is_paid boolean,
               created_in boolean, visited_in boolean, bookings bigint, revenue numeric)
language sql stable security invoker set search_path = public, pg_temp as $$
  with win as (
    select (p_from::timestamp at time zone 'Asia/Kolkata') as t0,
           ((p_to + 1)::timestamp at time zone 'Asia/Kolkata') as t1
  ),
  v as (
    select distinct sv.lead_id from site_visits sv, win
     where sv.status = 'completed'
       and (win.t0 is null or coalesce(sv.visited_at, sv.visit_date, sv.scheduled_at) >= win.t0)
       and (win.t1 is null or coalesce(sv.visited_at, sv.visit_date, sv.scheduled_at) < win.t1)
  ),
  b as (
    select c.lead_id, count(*) n, sum(bk.total_sale_value) rev
      from bookings bk join clients c on c.id = bk.client_id
     where bk.status = 'confirmed' and c.lead_id is not null
       and (p_from is null or bk.booking_date >= p_from)
       and (p_to is null or bk.booking_date <= p_to)
     group by c.lead_id
  )
  select l.id, l.marketing_campaign_id, l.source_key, l.orphan_label, l.is_paid,
         (win.t0 is null or l.created_at >= win.t0) and (win.t1 is null or l.created_at < win.t1),
         v.lead_id is not null,
         coalesce(b.n, 0), coalesce(b.rev, 0)
  from marketing_leads() l cross join win
  left join v on v.lead_id = l.id
  left join b on b.lead_id = l.id
$$;

create or replace function public.marketing_spend_in(p_from date, p_to date)
returns table (campaign_id uuid, spend numeric)
language sql stable security invoker set search_path = public, pg_temp as $$
  select s.campaign_id, sum(s.spend)
    from campaign_spend_logs s
   where (p_from is null or s.log_date >= p_from) and (p_to is null or s.log_date <= p_to)
   group by s.campaign_id
$$;

create or replace function public.marketing_roi_by_source(p_from date default null, p_to date default null)
returns table (source_key text, leads_count bigint, site_visits_count bigint, bookings_count bigint,
               revenue numeric, spend numeric)
language sql stable security invoker set search_path = public, pg_temp as $$
  with f as (select * from marketing_lead_funnel(p_from, p_to)),
  agg as (
    select f.source_key k,
           count(*) filter (where f.created_in) leads,
           count(*) filter (where f.visited_in) visits,
           sum(f.bookings) bookings, sum(f.revenue) revenue
      from f group by f.source_key
  ),
  sp as (
    select coalesce(marketing_source_key(coalesce(m.utm_source, m.platform)), 'unknown') k, sum(s.spend) amt
      from marketing_spend_in(p_from, p_to) s join marketing_campaigns m on m.id = s.campaign_id
     group by 1
  )
  select coalesce(agg.k, sp.k), coalesce(agg.leads, 0), coalesce(agg.visits, 0),
         coalesce(agg.bookings, 0)::bigint, coalesce(agg.revenue, 0), coalesce(sp.amt, 0)
    from agg full join sp on sp.k = agg.k
   where coalesce(agg.leads, 0) + coalesce(agg.visits, 0) + coalesce(agg.bookings, 0) > 0
      or coalesce(sp.amt, 0) > 0
$$;

-- One row per campaign, plus one per tag/name that leads carry but no campaign matches
-- ("unlinked": campaign_id null) so missing campaigns are visible instead of silently lost.
create or replace function public.marketing_roi_by_campaign(p_from date default null, p_to date default null)
returns table (campaign_id uuid, campaign_name text, platform text, utm_source text, utm_campaign text,
               status text, leads_count bigint, site_visits_count bigint, bookings_count bigint,
               revenue numeric, spend numeric)
language sql stable security invoker set search_path = public, pg_temp as $$
  with f as (
    select f.*, coalesce(f.marketing_campaign_id::text, 'orphan:' || lower(f.orphan_label)) g
      from marketing_lead_funnel(p_from, p_to) f
     where f.marketing_campaign_id is not null or f.orphan_label is not null
  ),
  agg as (
    select g, min(orphan_label) label, min(source_key) k,
           count(*) filter (where created_in) leads,
           count(*) filter (where visited_in) visits,
           sum(bookings) bookings, sum(revenue) revenue
      from f group by g
  ),
  sp as (select campaign_id::text g, spend from marketing_spend_in(p_from, p_to))
  select m.id, coalesce(m.name, agg.label), m.platform, coalesce(m.utm_source, agg.k), m.utm_campaign, m.status,
         coalesce(agg.leads, 0), coalesce(agg.visits, 0), coalesce(agg.bookings, 0)::bigint,
         coalesce(agg.revenue, 0), coalesce(sp.spend, 0)
    from agg
    full join marketing_campaigns m on m.id::text = agg.g
    left join sp on sp.g = coalesce(m.id::text, agg.g)
   where m.id is not null or agg.leads + agg.visits + agg.bookings > 0
$$;

-- Headline: spend against PAID leads only, with the same funnel definitions as the tables.
create or replace function public.marketing_headline(p_from date default null, p_to date default null)
returns table (total_spend numeric, active_campaigns bigint, paid_leads bigint, paid_site_visits bigint,
               paid_bookings bigint, paid_revenue numeric)
language sql stable security invoker set search_path = public, pg_temp as $$
  select (select coalesce(sum(spend), 0) from marketing_spend_in(p_from, p_to)),
         (select count(*) from marketing_campaigns where status = 'active'),
         count(*) filter (where created_in),
         count(*) filter (where visited_in),
         coalesce(sum(bookings), 0)::bigint,
         coalesce(sum(revenue), 0)
    from marketing_lead_funnel(p_from, p_to)
   where is_paid
$$;

revoke all on function public.marketing_leads() from public, anon;
revoke all on function public.marketing_lead_funnel(date, date) from public, anon;
revoke all on function public.marketing_spend_in(date, date) from public, anon;
revoke all on function public.marketing_roi_by_source(date, date) from public, anon;
revoke all on function public.marketing_roi_by_campaign(date, date) from public, anon;
revoke all on function public.marketing_headline(date, date) from public, anon;
grant execute on function public.marketing_leads(), public.marketing_lead_funnel(date, date),
  public.marketing_spend_in(date, date), public.marketing_roi_by_source(date, date),
  public.marketing_roi_by_campaign(date, date), public.marketing_headline(date, date)
  to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- B5 / B8  Broadcast start is an atomic claim; failures are recorded.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.whatsapp_broadcasts add column if not exists last_error text;
alter table public.whatsapp_broadcasts drop constraint if exists whatsapp_broadcasts_status_check;
alter table public.whatsapp_broadcasts add constraint whatsapp_broadcasts_status_check
  check (status in ('draft', 'scheduled', 'queueing', 'sending', 'sent', 'paused', 'cancelled'));

-- One row per number per broadcast: a double start can never message someone twice.
delete from public.whatsapp_broadcast_recipients r
 using public.whatsapp_broadcast_recipients d
 where r.broadcast_id = d.broadcast_id and r.phone = d.phone and r.created_at > d.created_at;
create unique index if not exists whatsapp_broadcast_recipients_broadcast_phone_key
  on public.whatsapp_broadcast_recipients (broadcast_id, phone);
create index if not exists idx_wa_broadcast_recipients_queued
  on public.whatsapp_broadcast_recipients (broadcast_id, created_at) where status = 'queued';

-- ─────────────────────────────────────────────────────────────────────────────
-- B1  Drive broadcasts every 5 minutes (Vercel's daily cron stays as a fallback).
--     URL and secret come from Vault (crm_base_url, crm_cron_secret); without them,
--     and whenever nothing is due, the job does nothing.
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists pg_net with schema extensions;

create or replace function public.kick_broadcast_cron()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (
    select 1 from whatsapp_broadcasts
     where status = 'sending'
        or (status = 'scheduled' and scheduled_at <= now())
        or (status = 'queueing' and updated_at < now() - interval '10 minutes')
  ) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'crm_base_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'crm_cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/cron/broadcasts',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;
revoke all on function public.kick_broadcast_cron() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'broadcasts-every-5-min';
select cron.schedule('broadcasts-every-5-min', '*/5 * * * *', $c$select public.kick_broadcast_cron()$c$);
