-- Checks for migration 20261021100000 (SLA stage clock, booking numbers, unique names, session purge, data clean-up).
-- Rolled back; prints only failures plus a TOTAL row.
begin;
create temp table t(name text, ok boolean, detail text);

do $$
declare l uuid; before_ts timestamptz; after_ts timestamptz; same_ts timestamptz; ins_ts timestamptz;
begin
  select id, stage_changed_at into l, before_ts from leads where stage = 'contacted' limit 1;
  update leads set updated_at = now() where id = l;                 -- not a stage change
  select stage_changed_at into same_ts from leads where id = l;
  update leads set stage = 'interested' where id = l;               -- a stage change
  select stage_changed_at into after_ts from leads where id = l;
  insert into t values ('stage_changed_at is unchanged by edits that do not move the stage', same_ts = before_ts, same_ts::text);
  insert into t values ('stage_changed_at moves when the stage changes', after_ts > before_ts, after_ts::text);
  insert into leads (full_name, phone, stage) values ('tmp', '9000000001', 'new_lead') returning stage_changed_at into ins_ts;
  insert into t values ('a new lead gets stage_changed_at', ins_ts is not null, '');
end $$;

insert into t select 'every lead has stage_changed_at', not exists (select 1 from leads where stage_changed_at is null), '';

do $$
declare b bookings; n1 text; n2 text;
begin
  select * into b from bookings limit 1;
  insert into bookings (client_id, plot_id, project_id, total_sale_value, booking_amount, status, booking_date)
    select b.client_id, id, project_id, 1, 1, 'cancelled', current_date from plots where status = 'available' order by id limit 1 returning booking_number into n1;
  insert into bookings (client_id, plot_id, project_id, total_sale_value, booking_amount, status, booking_date)
    select b.client_id, id, project_id, 1, 1, 'cancelled', current_date from plots where status = 'available' order by id desc limit 1 returning booking_number into n2;
  insert into t values ('booking numbers are BKG-<year>-NNN', n1 ~ '^BKG-[0-9]{4}-[0-9]{3,}$', n1);
  insert into t values ('consecutive booking numbers are different and increasing', n1 <> n2 and n2 > n1, n1 || ' / ' || n2);
end $$;

do $$
declare r text;
begin
  begin insert into whatsapp_templates (name, display_name, category, language, body) select name, 'dup', category, language, 'x' from whatsapp_templates limit 1; r := 'accepted';
  exception when unique_violation then r := 'rejected'; end;
  insert into t values ('a template name is unique per language', r = 'rejected', r);
  begin insert into marketing_campaigns (name, platform, utm_campaign, start_date) select 'dup', platform, utm_campaign, start_date from marketing_campaigns where utm_campaign is not null limit 1; r := 'accepted';
  exception when unique_violation then r := 'rejected'; end;
  insert into t values ('a utm_campaign tag is unique', r = 'rejected', r);
end $$;

insert into t select 'session purge job is scheduled daily', exists (select 1 from cron.job where jobname = 'purge-old-user-sessions' and schedule = '15 3 * * *' and active), '';
do $$
declare uid uuid := (select id from profiles limit 1); left_over int;
begin
  insert into user_sessions (user_id, session_id, created_at, last_active_at) values (uid, 'old-test-session', now() - interval '45 days', now() - interval '45 days'), (uid, 'new-test-session', now(), now());
  perform public.purge_old_sessions();
  select count(*) into left_over from user_sessions where session_id in ('old-test-session', 'new-test-session');
  insert into t values ('purge removes sessions older than 30 days and keeps recent ones', left_over = 1 and exists (select 1 from user_sessions where session_id = 'new-test-session'), left_over::text);
end $$;
insert into t select 'purge function is not callable by the public roles', not has_function_privilege('anon', 'public.purge_old_sessions()', 'execute') and not has_function_privilege('authenticated', 'public.purge_old_sessions()', 'execute'), '';

insert into t select 'DATA: no booked plot without a booking', not exists (select 1 from plots p where p.status = 'booked' and not exists (select 1 from bookings b where b.plot_id = p.id and b.status = 'confirmed')), '';
insert into t select 'DATA: no hold without expiry or pending booking', not exists (select 1 from plots p where p.status = 'soft_hold' and p.held_until is null and not exists (select 1 from bookings b where b.plot_id = p.id and b.status = 'pending_approval')), '';

select name, ok, detail from t where not ok union all select 'TOTAL checks', true, count(*)::text from t;
rollback;
