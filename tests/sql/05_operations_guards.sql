-- Operations audit guards (migration 20261024100000). Run in the SQL editor: it always ends with
-- RAISE 'RESULT: …' so every write is rolled back. Every item must read 'ok' (none 'FAIL').
do $$
declare adv uuid; mgr uuid; adm uuid; r text := ''; n int; lid uuid;
begin
  select id into adv from profiles where role='sales_advisor' and is_active and team_id is not null limit 1;
  select id into mgr from profiles where role='manager' limit 1;
  select id into adm from profiles where role='admin' limit 1;

  -- advisor session
  perform set_config('request.jwt.claims', json_build_object('sub',adv,'role','authenticated')::text, true);
  set local role authenticated;
  begin update profiles set base_salary = 999999 where id = adv; r := r||'FAIL salary allowed; '; exception when others then r := r||'ok salary blocked; '; end;
  begin update profiles set phone = phone, emergency_contact = 'x' where id = adv; get diagnostics n = row_count; r := r||'ok self phone rows='||n||'; '; exception when others then r := r||'FAIL self phone '||sqlerrm||'; '; end;
  begin insert into leave_requests(user_id,leave_type,from_date,to_date,days_count,status) values (adv,'casual',current_date+1,current_date+2,2,'approved'); r := r||'FAIL approved insert; '; exception when others then r := r||'ok approved insert blocked; '; end;
  insert into leave_requests(user_id,leave_type,from_date,to_date,days_count) values (adv,'maternity',current_date+1,current_date+2,2) returning id into lid; r := r||'ok pending maternity; ';
  begin update leave_requests set status='approved' where id=lid; r := r||'FAIL self approve; '; exception when others then r := r||'ok self approve blocked; '; end;
  update leave_requests set status='cancelled' where id=lid; get diagnostics n = row_count; r := r||'ok cancel rows='||n||'; ';
  begin insert into attendance_logs(user_id,date,status) values (adv, current_date-5,'present'); r := r||'FAIL backdate; '; exception when others then r := r||'ok backdate blocked; '; end;
  begin insert into attendance_logs(user_id,date,status,check_in_at) values (adv, (now() at time zone 'Asia/Kolkata')::date,'present',now()); r := r||'ok checkin; '; exception when others then r := r||'FAIL checkin '||sqlerrm||'; '; end;
  begin update attendance_logs set check_in_at = now() - interval '3 hours' where user_id=adv and date=(now() at time zone 'Asia/Kolkata')::date; r := r||'FAIL re-checkin; '; exception when others then r := r||'ok re-checkin blocked; '; end;
  update attendance_logs set check_out_at = now() where user_id=adv and date=(now() at time zone 'Asia/Kolkata')::date; get diagnostics n=row_count; r := r||'ok checkout rows='||n||'; ';
  select count(*) into n from payroll_slips; r := r||'adv slips visible='||n||'; ';
  begin insert into hr_leave_balances(user_id,year,leave_type,entitled,used) values (adv,2026,'casual',99,0); r := r||'FAIL adv balance; '; exception when others then r := r||'ok adv balance blocked; '; end;
  begin update teams set name = name; get diagnostics n=row_count; r := r||'adv team rows='||n||'; '; end;
  reset role;

  -- manager session
  perform set_config('request.jwt.claims', json_build_object('sub',mgr,'role','authenticated')::text, true);
  set local role authenticated;
  begin insert into payroll_runs(year,month) values (2030,1); r := r||'FAIL mgr payroll; '; exception when others then r := r||'ok mgr payroll blocked; '; end;
  begin insert into hr_leave_balances(user_id,year,leave_type,entitled,used) values (mgr,2026,'casual',99,0); r := r||'FAIL mgr own balance; '; exception when others then r := r||'ok mgr own balance blocked; '; end;
  begin insert into team_targets(user_id,month,year,target_revenue) values (mgr,1,2030,1); r := r||'FAIL mgr own target; '; exception when others then r := r||'ok mgr own target blocked; '; end;
  update teams set name = name; get diagnostics n=row_count; r := r||'mgr team rows='||n||'; ';
  reset role;

  -- admin session
  perform set_config('request.jwt.claims', json_build_object('sub',adm,'role','authenticated')::text, true);
  set local role authenticated;
  insert into payroll_runs(year,month) values (2030,2); r := r||'ok admin payroll; ';
  select count(*) into n from leave_requests; r := r||'admin sees leaves='||n||'; ';
  insert into team_targets(user_id,month,year,target_revenue) values (adv,1,2030,1); r := r||'ok admin target; ';
  reset role;

  -- constraints (no JWT)
  perform set_config('request.jwt.claims', '', true);
  insert into automations(name,trigger_event,action_type,action_payload) values ('t','lead_created','send_notification','{}');
  insert into automation_pending_executions(automation_id, scheduled_for, status) select id, now(), 'running' from automations limit 1;
  insert into hr_leave_balances(user_id,year,leave_type,entitled,used) values (adv,2026,'comp_off',0,1);
  r := r||'ok constraints; ';
  set local role anon;
  begin insert into career_applications(name,phone,stage) values ('x','1','offer'); r := r||'FAIL anon offer; '; exception when others then r := r||'ok anon offer blocked; '; end;
  insert into career_applications(name,phone) values ('x','1'); r := r||'ok anon apply; ';
  reset role;
  raise exception 'RESULT: %', r;
end $$;
