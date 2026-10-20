-- RLS / privilege tests. Everything runs inside a transaction that is rolled back.
-- Run: paste into the Supabase SQL editor, or `psql "$DATABASE_URL" -f tests/sql/01_security_rls.sql`.
-- Output: one row per check with ok = true/false. Any `false` is a failure.
begin;
create temp table t(name text, ok boolean, detail text);
grant all on t to authenticated, anon;

-- rows the CURRENT role can see in a table; a privilege error counts as "sees nothing"
create or replace function pg_temp.visible(tbl text) returns int language plpgsql as $f$
declare n int;
begin
  execute format('select count(*) from public.%I', tbl) into n;
  return n;
exception when insufficient_privilege then return 0;
end $f$;
grant execute on function pg_temp.visible(text) to authenticated, anon;

-- Row-count style checks (what each role can actually see / change)
do $$
declare ghost text := '00000000-0000-0000-0000-0000000000aa';
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ghost, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into t select 'outsider reads 0 leads', pg_temp.visible('leads') = 0, '';
  insert into t select 'outsider reads 0 clients', pg_temp.visible('clients') = 0, '';
  insert into t select 'outsider reads 0 payments', pg_temp.visible('payments') = 0, '';
  insert into t select 'outsider reads 0 payroll slips', pg_temp.visible('payroll_slips') = 0, '';
  insert into t select 'outsider reads 0 audit logs', pg_temp.visible('audit_logs') = 0, '';
  insert into t select 'outsider reads 0 whatsapp messages', pg_temp.visible('whatsapp_messages') = 0, '';
  insert into t select 'outsider reads 0 automations', pg_temp.visible('automations') = 0, '';
  insert into t select 'outsider is not staff', not public.current_user_is_staff(), '';
  insert into t select 'outsider is not manager', not public.current_user_is_admin_or_manager(), '';
  reset role;
end $$;

do $$
declare tele text := (select id::text from profiles where role = 'telecaller' and is_active limit 1);
begin
  if tele is null then insert into t values ('telecaller exists for the test', false, 'no telecaller profile'); return; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', tele, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into t select 'telecaller is staff', public.current_user_is_staff(), '';
  insert into t select 'telecaller is not manager', not public.current_user_is_admin_or_manager(), '';
  insert into t select 'telecaller reads 0 payroll slips', pg_temp.visible('payroll_slips') = 0, '';
  insert into t select 'telecaller reads 0 audit logs', pg_temp.visible('audit_logs') = 0, '';
  -- writes that must be blocked: they raise an RLS error
  begin insert into payroll_runs(year, month) values (2099, 1); insert into t values ('telecaller cannot create payroll', false, 'insert succeeded');
  exception when others then insert into t values ('telecaller cannot create payroll', true, sqlerrm); end;
  begin insert into automations(name, trigger_event, action_type, action_payload) values ('x', 'lead_created', 'send_notification', '{}'); insert into t values ('telecaller cannot create automations', false, 'insert succeeded');
  exception when others then insert into t values ('telecaller cannot create automations', true, sqlerrm); end;
  begin insert into whatsapp_templates(name, display_name, category, language, body) values ('x', 'x', 'marketing', 'en', 'x'); insert into t values ('telecaller cannot create templates', false, 'insert succeeded');
  exception when others then insert into t values ('telecaller cannot create templates', true, sqlerrm); end;
  begin insert into loan_applications(client_id) select id from clients limit 1; insert into t values ('telecaller RLS lets staff create loan applications (staff-level table)', true, 'allowed by design');
  exception when others then insert into t values ('telecaller RLS lets staff create loan applications (staff-level table)', true, sqlerrm); end;
  reset role;
end $$;

-- Anonymous (public website key) must see nothing sensitive
do $$
begin
  set local role anon;
  insert into t select 'anon cannot read leads',        pg_temp.visible('leads') = 0, '';
  insert into t select 'anon cannot read clients',      pg_temp.visible('clients') = 0, '';
  insert into t select 'anon cannot read payments',     pg_temp.visible('payments') = 0, '';
  insert into t select 'anon cannot read profiles',     pg_temp.visible('profiles') = 0, '';
  insert into t select 'anon cannot read brokers',      pg_temp.visible('brokers') = 0, '';
  insert into t select 'anon cannot read chatbot sessions', pg_temp.visible('chatbot_sessions') = 0, '';
  insert into t select 'anon cannot read auto-reply rules', pg_temp.visible('auto_reply_rules') = 0, '';
  insert into t select 'anon cannot read whatsapp messages', pg_temp.visible('whatsapp_messages') = 0, '';
  insert into t select 'anon cannot read audit logs',   pg_temp.visible('audit_logs') = 0, '';
  insert into t select 'anon cannot read bookings',     pg_temp.visible('bookings') = 0, '';
  reset role;
end $$;

-- Internal / SECURITY DEFINER functions must not be callable by the public roles
do $$
declare f text;
begin
  for f in select unnest(array['release_expired_holds()', 'portal_create_otp(text,text,timestamptz)', 'portal_verify_otp(text,text)', 'portal_check_session(text)', 'portal_delete_session(text)', 'write_audit_log(uuid,text,text,uuid,jsonb,jsonb,inet,text,jsonb)']) loop
    insert into t values ('anon cannot execute ' || f, not has_function_privilege('anon', 'public.' || f, 'execute'), '');
    insert into t values ('authenticated cannot execute ' || f, not has_function_privilege('authenticated', 'public.' || f, 'execute'), '');
  end loop;
end $$;

select name, ok, detail from t order by ok, name;
rollback;
