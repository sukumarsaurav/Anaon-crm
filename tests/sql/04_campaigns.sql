-- Checks for migrations 20261022100000 / 20261022100100 (campaign fixes: derived spend, lead → campaign
-- attribution, ROI functions, broadcast claim/uniqueness, broadcast cron).
-- Rolled back; prints only failures plus a TOTAL row.
begin;
create temp table t(name text, ok boolean, detail text);

-- M1: spend is the sum of the logs, kept by trigger; the opening balance preserved old spend.
insert into t select 'every campaign''s spend equals the sum of its logs',
  not exists (select 1 from marketing_campaigns c
               where c.spend <> coalesce((select sum(spend) from campaign_spend_logs l where l.campaign_id = c.id), 0)), '';

do $$
declare c uuid; base numeric; s1 numeric; s2 numeric; s3 numeric; dup boolean := false;
begin
  insert into marketing_campaigns (name, platform, start_date, utm_campaign) values ('SQL test', 'other', '2026-01-01', 'sql_test_tag') returning id into c;
  insert into campaign_spend_logs (campaign_id, log_date, spend, kind) values (c, '2026-01-01', 1000, 'opening');
  select spend into base from marketing_campaigns where id = c;
  insert into campaign_spend_logs (campaign_id, log_date, spend) values (c, '2026-10-19', 5000);
  select spend into s1 from marketing_campaigns where id = c;
  update campaign_spend_logs set spend = 7000 where campaign_id = c and log_date = '2026-10-19' and kind = 'daily';
  select spend into s2 from marketing_campaigns where id = c;
  delete from campaign_spend_logs where campaign_id = c and kind = 'daily';
  select spend into s3 from marketing_campaigns where id = c;
  insert into t values ('a daily log adds to the opening balance', base = 1000 and s1 = 6000, s1::text);
  insert into t values ('editing a log updates the total', s2 = 8000, s2::text);
  insert into t values ('deleting a log updates the total', s3 = 1000, s3::text);
  begin
    insert into campaign_spend_logs (campaign_id, log_date, spend) values (c, '2026-10-18', 1), (c, '2026-10-18', 2);
  exception when unique_violation then dup := true;
  end;
  insert into t values ('one daily log per campaign per date', dup, '');
end $$;

-- M3 / M11: keys, dates, attribution.
do $$
declare ci boolean := false; dates boolean := false; c uuid; l uuid; linked uuid; relinked uuid; meta_l uuid; meta_linked uuid;
begin
  begin
    insert into marketing_campaigns (name, platform, start_date, utm_campaign) values ('dup', 'other', '2026-01-01', ' SQL_TEST_TAG ');
  exception when unique_violation then ci := true;
  end;
  insert into t values ('utm_campaign is unique regardless of case and spaces', ci, '');
  begin
    insert into marketing_campaigns (name, platform, start_date, end_date) values ('bad dates', 'other', '2026-02-01', '2026-01-01');
  exception when check_violation then dates := true;
  end;
  insert into t values ('end date cannot be before start date', dates, '');

  -- A Meta lead carries the ad-manager campaign NAME; creating the campaign afterwards links it.
  insert into leads (full_name, phone, stage, source, utm_campaign, campaign_name)
    values ('sql meta lead', '9000000101', 'new_lead', 'facebook_ads', 'SQL Diwali Plots', 'SQL Diwali Plots') returning id into l;
  insert into marketing_campaigns (name, platform, start_date, utm_campaign) values ('sql diwali plots', 'facebook', '2026-01-01', 'sql_diwali') returning id into c;
  select marketing_campaign_id into linked from leads where id = l;
  insert into t values ('a campaign created after its leads picks them up by name (case-insensitive)', linked = c, coalesce(linked::text, 'null'));
  update marketing_campaigns set name = 'renamed' where id = c;
  select marketing_campaign_id into relinked from leads where id = l;
  insert into t values ('renaming the campaign away from the lead''s name unlinks it', relinked is null, coalesce(relinked::text, 'null'));

  update marketing_campaigns set meta_campaign_id = 'sql-meta-1' where id = c;
  insert into leads (full_name, phone, stage, source, meta_campaign_id, utm_campaign)
    values ('sql id lead', '9000000102', 'new_lead', 'facebook_ads', 'sql-meta-1', 'anything else') returning id into meta_l;
  select marketing_campaign_id into meta_linked from leads where id = meta_l;
  insert into t values ('a lead with the Meta campaign ID is linked on insert', meta_linked = c, coalesce(meta_linked::text, 'null'));
end $$;

insert into t select 'every lead that resolves to a campaign is linked to it',
  not exists (select 1 from leads where marketing_campaign_id is distinct from resolve_marketing_campaign(meta_campaign_id, utm_campaign, campaign_name)
                                     and marketing_campaign_id is null and resolve_marketing_campaign(meta_campaign_id, utm_campaign, campaign_name) is not null), '';

-- ROI functions agree with each other.
insert into t select 'campaign ROI spend equals total campaign spend',
  (select coalesce(sum(spend), 0) from marketing_roi_by_campaign()) = (select coalesce(sum(spend), 0) from marketing_campaigns), '';
insert into t select 'source ROI spend equals total campaign spend',
  (select coalesce(sum(spend), 0) from marketing_roi_by_source()) = (select coalesce(sum(spend), 0) from marketing_campaigns), '';
insert into t select 'source ROI counts every live, non-duplicate lead once',
  (select sum(leads_count) from marketing_roi_by_source()) = (select count(*) from leads where is_active and not coalesce(is_duplicate, false)), '';
insert into t select 'headline spend equals total campaign spend',
  (select total_spend from marketing_headline()) = (select coalesce(sum(spend), 0) from marketing_campaigns), '';
insert into t select 'a site visit is a lead, so visits never exceed leads per source',
  not exists (select 1 from marketing_roi_by_source() where site_visits_count > (select count(*) from leads)), '';
insert into t select 'a future window has no activity',
  (select coalesce(sum(leads_count + site_visits_count + bookings_count), 0) from marketing_roi_by_source('2099-01-01', '2099-12-31')) = 0, '';
insert into t select 'source keys are normalised (no _ads / portal99acres spellings)',
  not exists (select 1 from marketing_roi_by_source() where source_key in ('facebook_ads', 'instagram_ads', 'google_ads', 'portal99acres', 'website_form')), '';
insert into t select 'the campaign resolver is not callable over the API',
  not has_function_privilege('authenticated', 'public.resolve_marketing_campaign(text, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.resolve_marketing_campaign(text, text, text)', 'execute'), '';
insert into t select 'ROI functions are not callable by anon',
  not has_function_privilege('anon', 'public.marketing_roi_by_source(date, date)', 'execute')
  and not has_function_privilege('anon', 'public.marketing_headline(date, date)', 'execute'), '';

-- Broadcasts.
insert into t select 'broadcast recipients are unique per number',
  exists (select 1 from pg_indexes where indexname = 'whatsapp_broadcast_recipients_broadcast_phone_key'), '';
insert into t select 'queueing is an allowed broadcast status',
  pg_get_constraintdef((select oid from pg_constraint where conname = 'whatsapp_broadcasts_status_check')) like '%queueing%', '';
insert into t select 'the 5-minute broadcast job is scheduled',
  exists (select 1 from cron.job where jobname = 'broadcasts-every-5-min' and schedule = '*/5 * * * *'), '';
insert into t select 'the broadcast kicker is not callable by the public roles',
  not has_function_privilege('anon', 'public.kick_broadcast_cron()', 'execute')
  and not has_function_privilege('authenticated', 'public.kick_broadcast_cron()', 'execute'), '';

select name, ok, detail from t where not ok union all select 'TOTAL checks', true, count(*)::text from t;
rollback;
