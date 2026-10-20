-- Menu-audit guards (migration 20261023100000). Run through the Supabase MCP; everything rolls back.
-- Prints one row per check; every `ok` must be true.
begin;
create temp table _t(check_name text, ok boolean) on commit drop;
grant all on _t to authenticated;

do $$
declare
  adv uuid; mgr uuid; other uuid; b uuid; plot_free uuid; plot_other uuid; proj uuid;
  ok boolean;
begin
  select id into adv   from profiles where role = 'sales_advisor' and is_active order by created_at limit 1;
  select id into mgr   from profiles where role in ('admin','manager') and is_active order by created_at limit 1;
  select id into other from profiles where role in ('sales_advisor','telecaller') and id <> adv order by created_at limit 1;
  other := coalesce(other, mgr);

  -- Fixtures (as postgres): a pending booking owned by the advisor, a free plot, a plot held by someone else.
  select id into b from bookings limit 1;
  update bookings set advisor_id = adv, created_by = adv, status = 'pending_approval', approved_by = null, approved_at = null where id = b;
  select id, project_id into plot_free, proj from plots where status = 'available' limit 1;
  select id into plot_other from plots where status = 'available' and id <> plot_free limit 1;
  update plots set status = 'soft_hold', held_by = other where id = plot_other;

  perform set_config('app.b', b::text, true);
  perform set_config('app.pf', plot_free::text, true);
  perform set_config('app.po', plot_other::text, true);
  perform set_config('app.adv', adv::text, true);
  perform set_config('app.mgr', mgr::text, true);
end $$;

-- ── as the advisor ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('app.adv'), 'role', 'authenticated')::text, true);
set local role authenticated;

do $$ begin
  begin update bookings set status = 'confirmed' where id = current_setting('app.b')::uuid;
        insert into _t values ('advisor cannot confirm booking', false);
  exception when insufficient_privilege then insert into _t values ('advisor cannot confirm booking', true); end;

  begin update payments set status = 'paid', amount_paid = amount_due where booking_id = current_setting('app.b')::uuid;
        insert into _t values ('advisor cannot mark payments paid', not found);
  exception when insufficient_privilege then insert into _t values ('advisor cannot mark payments paid', true); end;

  begin update plots set base_price = 1 where id = current_setting('app.pf')::uuid;
        insert into _t values ('advisor cannot change plot price', false);
  exception when insufficient_privilege then insert into _t values ('advisor cannot change plot price', true); end;

  begin update plots set status = 'available', held_by = null where id = current_setting('app.po')::uuid;
        insert into _t values ('advisor cannot release another hold', false);
  exception when insufficient_privilege then insert into _t values ('advisor cannot release another hold', true); end;

  begin update plots set status = 'soft_hold', held_by = auth.uid(), held_until = now() + interval '1 day' where id = current_setting('app.pf')::uuid;
        insert into _t values ('advisor can hold a free plot', found);
  exception when others then insert into _t values ('advisor can hold a free plot', false); end;

  begin update plots set status = 'soft_hold', held_by = auth.uid(), held_until = null where id = current_setting('app.pf')::uuid;
        insert into _t values ('advisor can re-hold own plot for a booking', found);
  exception when others then insert into _t values ('advisor can re-hold own plot for a booking', false); end;

  begin update plots set status = 'booked' where id = current_setting('app.pf')::uuid;
        insert into _t values ('advisor cannot mark a plot booked', false);
  exception when insufficient_privilege then insert into _t values ('advisor cannot mark a plot booked', true); end;

  begin update plots set status = 'available', held_by = null, held_until = null where id = current_setting('app.pf')::uuid;
        insert into _t values ('advisor can release own hold', found);
  exception when others then insert into _t values ('advisor can release own hold', false); end;
end $$;

-- ── as a manager ──
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('app.mgr'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin update bookings set status = 'confirmed', approved_by = auth.uid(), approved_at = now() where id = current_setting('app.b')::uuid;
        insert into _t values ('manager can confirm booking', found);
  exception when others then insert into _t values ('manager can confirm booking', false); end;
end $$;
reset role;

-- ── price escalation ──
select set_config('request.jwt.claims', '', true);
do $$
declare p uuid; before numeric; after numeric;
begin
  select id, base_price into p, before from plots where status = 'available' and base_price > 0 limit 1;
  insert into price_escalations(project_id, escalation_date, percentage_increase, applied)
    select project_id, current_date - 1, 10, false from plots where id = p;
  perform public.apply_due_price_escalations();
  select base_price into after from plots where id = p;
  insert into _t values ('escalation raises unsold base price 10%', after = round(before * 1.1));
end $$;

select * from _t;
rollback;
