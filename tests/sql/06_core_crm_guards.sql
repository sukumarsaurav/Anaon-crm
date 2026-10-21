-- Core CRM guards (migration 20261025100000). Run in the SQL editor: it always ends with
-- RAISE 'RESULT: …' so every write is rolled back. Every item must read 'ok' (none 'FAIL').
do $$
declare adv uuid; adm uuid; r text := ''; n int; lid uuid; other uuid; pid uuid; bid uuid;
begin
  select id into adv from profiles where role='sales_advisor' and is_active and team_id is not null limit 1;
  select id into adm from profiles where role='admin' limit 1;
  select id into lid from leads where assigned_to = adv and is_active and stage <> 'closed_won' limit 1;
  select id into other from leads where assigned_to is distinct from adv and created_by is distinct from adv limit 1;
  select id into pid from plots where status = 'available' limit 1;

  -- advisor session
  perform set_config('request.jwt.claims', json_build_object('sub',adv,'role','authenticated')::text, true);
  set local role authenticated;
  begin update leads set stage='closed_won' where id=lid; r := r||'FAIL closed_won; '; exception when others then r := r||'ok closed_won blocked; '; end;
  begin update leads set is_active=false where id=lid; r := r||'FAIL soft delete; '; exception when others then r := r||'ok soft delete blocked; '; end;
  begin update leads set created_by=adm where id=lid; r := r||'FAIL created_by; '; exception when others then r := r||'ok created_by blocked; '; end;
  update leads set stage='interested' where id=lid; get diagnostics n=row_count; r := r||'ok normal stage rows='||n||'; ';
  begin insert into leads(full_name, phone, stage, created_by, assigned_to) values ('x','9000000000','closed_won',adv,adv); r := r||'FAIL won insert; '; exception when others then r := r||'ok won insert blocked; '; end;
  begin insert into lead_activities(lead_id,type,notes,performed_by) values (lid,'note','x',adm); r := r||'FAIL forged performer; '; exception when others then r := r||'ok forged performer blocked; '; end;
  begin insert into lead_activities(lead_id,type,notes,performed_by) values (other,'note','x',adv); r := r||'FAIL invisible lead; '; exception when others then r := r||'ok invisible lead blocked; '; end;
  insert into lead_activities(lead_id,type,notes,performed_by) values (lid,'note','x',adv); r := r||'ok own activity; ';
  -- pending-booking hold
  if pid is not null then
    update plots set status='soft_hold', held_by=adv, held_until=null where id=pid;
    reset role;
    insert into bookings(client_id, plot_id, project_id, total_sale_value, booking_amount, status, created_by, advisor_id)
      select (select id from clients limit 1), pid, (select project_id from plots where id=pid), 1, 1, 'pending_approval', adv, adv returning id into bid;
    set local role authenticated;
    begin update plots set status='available', held_by=null where id=pid; r := r||'FAIL release pending hold; '; exception when others then r := r||'ok pending hold kept; '; end;
  else
    r := r||'skip hold (no available plot); ';
  end if;
  reset role;

  -- admin session
  perform set_config('request.jwt.claims', json_build_object('sub',adm,'role','authenticated')::text, true);
  set local role authenticated;
  update leads set is_active=false where id=lid; get diagnostics n=row_count; r := r||'ok admin delete rows='||n||'; ';
  reset role;

  raise exception 'RESULT: %', r;
end $$;
