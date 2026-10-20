-- Constraints, triggers, scheduled jobs and database functions. Rolled back; nothing persists.
-- Output: failing checks only, plus a TOTAL row. Run in the Supabase SQL editor or via psql.
begin;
create temp table t(name text, ok boolean, detail text);
grant all on t to authenticated;

-- 1. one active booking per plot (unique index) ---------------------------------------------
do $$
declare b bookings; res text;
begin
  select * into b from bookings where status <> 'cancelled' limit 1;
  if b.id is null then insert into t values ('unique booking: needs a booking to test', false, 'no active booking'); return; end if;
  begin
    insert into bookings (client_id, plot_id, project_id, total_sale_value, booking_amount, status, booking_date)
    values (b.client_id, b.plot_id, b.project_id, 1, 1, 'pending_approval', current_date);
    res := 'second active booking was ALLOWED';
  exception when unique_violation then res := 'blocked';
  end;
  insert into t values ('a plot cannot have two active bookings', res = 'blocked', res);
end $$;

-- 2. hold release: frees expired holds, protects plots with a pending booking, closes the log --
do $$
declare p1 uuid; p2 uuid; b bookings; s1 text; s2 text; closed boolean;
begin
  select id into p1 from plots where status = 'available' order by id limit 1;
  select id into p2 from plots where status = 'available' and id <> p1 order by id limit 1;
  select * into b from bookings limit 1;
  if p1 is null or p2 is null or b.id is null then insert into t values ('hold release: needs 2 available plots', false, 'insufficient data'); return; end if;

  update plots set status = 'soft_hold', held_by = (select id from profiles limit 1), held_until = now() - interval '1 hour' where id in (p1, p2);
  insert into plot_holds_log (plot_id, project_id, held_by, expires_at) select id, project_id, held_by, held_until from plots where id = p1;
  -- p2 has a booking waiting for approval
  insert into bookings (client_id, plot_id, project_id, total_sale_value, booking_amount, status, booking_date)
  select b.client_id, p2, project_id, 1, 1, 'pending_approval', current_date from plots where id = p2;

  perform public.release_expired_holds();

  select status into s1 from plots where id = p1;
  select status into s2 from plots where id = p2;
  select released_at is not null and outcome = 'expired' into closed from plot_holds_log where plot_id = p1 order by created_at desc limit 1;
  insert into t values ('expired hold is released', s1 = 'available', s1);
  insert into t values ('a plot with a pending booking is NOT released', s2 = 'soft_hold', s2);
  insert into t values ('the hold log is closed as expired', coalesce(closed, false), '');
end $$;

-- 3. hold without expiry is never auto-released -----------------------------------------------
do $$
declare p uuid; s text;
begin
  select id into p from plots where status = 'available' limit 1;
  update plots set status = 'soft_hold', held_until = null where id = p;
  perform public.release_expired_holds();
  select status into s from plots where id = p;
  insert into t values ('an open-ended hold (no expiry) stays held', s = 'soft_hold', s);
end $$;

-- 4. lead temperature follows score (trigger) -------------------------------------------------
do $$
declare l uuid; hot text; warm text; cold text;
begin
  select id into l from leads limit 1;
  update leads set score = 85 where id = l; select temperature::text into hot from leads where id = l;
  update leads set score = 55 where id = l; select temperature::text into warm from leads where id = l;
  update leads set score = 10 where id = l; select temperature::text into cold from leads where id = l;
  insert into t values ('score 85 is hot', hot = 'hot', hot);
  insert into t values ('score 55 is warm', warm = 'warm', warm);
  insert into t values ('score 10 is cold', cold = 'cold', cold);
end $$;

-- 5. schema guarantees --------------------------------------------------------------------------
insert into t select 'plots.total_price is a generated column', exists (select 1 from information_schema.columns where table_name = 'plots' and column_name = 'total_price' and is_generated = 'ALWAYS'), '';
insert into t select 'leads.phone is NOT NULL', exists (select 1 from information_schema.columns where table_name = 'leads' and column_name = 'phone' and is_nullable = 'NO'), '';
insert into t select 'clients.phone is NOT NULL', exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'phone' and is_nullable = 'NO'), '';
insert into t select 'leads are active by default', exists (select 1 from information_schema.columns where table_name = 'leads' and column_name = 'is_active' and column_default ilike '%true%'), '';
insert into t select 'user_role includes broker', exists (select 1 from pg_enum e join pg_type ty on ty.oid = e.enumtypid where ty.typname = 'user_role' and e.enumlabel = 'broker'), '';
insert into t select 'every public table has RLS enabled', not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity), (select string_agg(tablename, ',') from pg_tables where schemaname = 'public' and not rowsecurity);
do $$
declare res text;
begin
  begin insert into leads (full_name, phone, stage) values ('x', '1', 'banana'); res := 'accepted a bad stage';
  exception when invalid_text_representation then res := 'rejected'; end;
  insert into t values ('an invalid lead stage is rejected by the enum', res = 'rejected', res);
  begin insert into plot_holds_log (plot_id, project_id, held_by, expires_at, outcome) select id, project_id, (select id from profiles limit 1), now(), 'nonsense' from plots limit 1; res := 'accepted';
  exception when check_violation then res := 'rejected'; end;
  insert into t values ('hold log outcome is constrained', res = 'rejected', res);
end $$;

-- 6. scheduled job -----------------------------------------------------------------------------
insert into t select 'pg_cron job releases expired holds every 15 min', exists (select 1 from cron.job where jobname = 'release-expired-plot-holds' and schedule = '*/15 * * * *' and active), '';

-- 7. portal OTP functions ------------------------------------------------------------------------
do $$
declare ph text := right(regexp_replace((select phone from clients limit 1), '\D', '', 'g'), 10); r text; tok text; i int;
begin
  insert into t values ('portal: a formatted stored phone is found', public.portal_create_otp(ph, 'h1', now() + interval '10 min') = 'ok', ph);
  insert into t values ('portal: an unknown phone is rejected', public.portal_create_otp('9000000000', 'h', now() + interval '10 min') = 'no_client', '');
  insert into t values ('portal: a wrong code is rejected', public.portal_verify_otp(ph, 'wrong') = 'invalid_otp', '');
  tok := public.portal_verify_otp(ph, 'h1');
  insert into t values ('portal: the right code returns a 64-char session token', length(tok) = 64, coalesce(tok, 'null'));
  insert into t values ('portal: the token resolves to the client', public.portal_check_session(tok) is not null, '');
  perform public.portal_delete_session(tok);
  insert into t values ('portal: logout kills the session', public.portal_check_session(tok) is null, '');
  -- rate limit: 3 requests per 10 minutes (one already used above)
  perform public.portal_create_otp(ph, 'h2', now() + interval '10 min');
  perform public.portal_create_otp(ph, 'h3', now() + interval '10 min');
  insert into t values ('portal: the 4th OTP request in 10 minutes is rate-limited', public.portal_create_otp(ph, 'h4', now() + interval '10 min') = 'rate_limited', '');
end $$;
do $$
declare ph text := right(regexp_replace((select phone from clients offset 1 limit 1), '\D', '', 'g'), 10); r text;
begin
  perform public.portal_create_otp(ph, 'right', now() + interval '10 min');
  for i in 1..5 loop perform public.portal_verify_otp(ph, 'bad'); end loop;
  insert into t values ('portal: five wrong attempts lock the code', public.portal_verify_otp(ph, 'right') = 'too_many_attempts', '');
end $$;

-- 8. new users: role comes from service-only app metadata ---------------------------------------
do $$
declare ra text; rb text;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
   ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tmp-broker@example.test', '{"role":"broker"}', '{}', now(), now()),
   ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tmp-plain@example.test', '{}', '{"role":"admin"}', now(), now());
  select role::text into ra from profiles where id = '11111111-1111-1111-1111-111111111111';
  select role::text into rb from profiles where id = '22222222-2222-2222-2222-222222222222';
  insert into t values ('app_metadata role=broker creates a broker profile', ra = 'broker', ra);
  insert into t values ('a user cannot make themselves admin through user_metadata', rb = 'sales_advisor', rb);
end $$;

-- 9. dashboard functions agree with the raw data ------------------------------------------------
do $$
declare admin_id text := (select id::text from profiles where role = 'admin' limit 1); st json; ex json; confirmed int; value numeric; owed numeric; ln json;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  st := public.get_booking_stats(); ex := public.get_exec_dashboard(); ln := public.get_loan_stats();
  select count(*), coalesce(sum(total_sale_value), 0) into confirmed, value from bookings where status = 'confirmed';
  select coalesce(sum(greatest(p.amount_due - coalesce(p.amount_paid, 0), 0)), 0) into owed from payments p join bookings b on b.id = p.booking_id where p.status in ('pending', 'overdue') and b.status = 'confirmed';
  insert into t values ('booking stats: confirmed count matches', (st->>'confirmed')::int = confirmed, st::text);
  insert into t values ('booking stats: total value matches', (st->>'total_value')::numeric = value, st::text);
  insert into t values ('exec dashboard: outstanding = due minus paid on confirmed bookings', (ex->>'outstanding')::numeric = owed, ex::text);
  insert into t values ('loan stats returns a stage map', ln->'byStage' is not null, ln::text);
  insert into t values ('advisor scorecard returns an array', json_typeof(public.get_advisor_scorecard(null, null)) = 'array', '');
  reset role;
end $$;

-- 10. referential sanity (real data problems show up here) -------------------------------------
insert into t select 'DATA: every confirmed booking has its plot marked booked', not exists (select 1 from bookings b join plots p on p.id = b.plot_id where b.status = 'confirmed' and p.status <> 'booked'), '';
insert into t select 'DATA: every booked plot has a confirmed booking', not exists (select 1 from plots p where p.status = 'booked' and not exists (select 1 from bookings b where b.plot_id = p.id and b.status = 'confirmed')), (select count(*)::text || ' booked plots without a booking' from plots p where p.status = 'booked' and not exists (select 1 from bookings b where b.plot_id = p.id and b.status = 'confirmed'));
insert into t select 'DATA: no soft hold lacks both an expiry and a pending booking', not exists (select 1 from plots p where p.status = 'soft_hold' and p.held_until is null and not exists (select 1 from bookings b where b.plot_id = p.id and b.status = 'pending_approval')), (select count(*)::text || ' stuck holds' from plots p where p.status = 'soft_hold' and p.held_until is null and not exists (select 1 from bookings b where b.plot_id = p.id and b.status = 'pending_approval'));
insert into t select 'DATA: no payments on cancelled bookings are still open', not exists (select 1 from payments pm join bookings b on b.id = pm.booking_id where b.status = 'cancelled' and pm.status in ('pending', 'overdue')), '';
insert into t select 'DATA: no paid installment is short of its amount', not exists (select 1 from payments where status = 'paid' and coalesce(amount_paid, 0) < amount_due), '';
insert into t select 'DATA: every active lead has a usable phone', not exists (select 1 from leads where is_active and right(regexp_replace(phone, '\D', '', 'g'), 10) !~ '^[6-9][0-9]{9}$'), (select count(*)::text || ' leads with unusable phones' from leads where is_active and right(regexp_replace(phone, '\D', '', 'g'), 10) !~ '^[6-9][0-9]{9}$');
insert into t select 'DATA: no active leads share a phone number', not exists (select 1 from leads where is_active group by right(regexp_replace(phone, '\D', '', 'g'), 10) having count(*) > 1), (select count(*)::text || ' duplicated numbers' from (select 1 from leads where is_active group by right(regexp_replace(phone, '\D', '', 'g'), 10) having count(*) > 1) d);
insert into t select 'DATA: every approved broker can log in (has a portal user)', not exists (select 1 from brokers where status = 'approved' and auth_user_id is null), (select count(*)::text || ' approved brokers without a login' from brokers where status = 'approved' and auth_user_id is null);

select name, ok, detail from t where not ok union all select 'TOTAL checks', true, count(*)::text from t;
rollback;
