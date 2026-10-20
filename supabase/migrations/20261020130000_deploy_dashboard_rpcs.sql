-- sql/performance_rpcs.sql defined these four functions but was a "paste into the SQL editor"
-- script that was never applied, so get_booking_stats / get_exec_dashboard / get_loan_stats /
-- get_advisor_scorecard did not exist. The app treats a missing result as "no data", so the
-- executive dashboard, booking and loan stat cards and the advisor scorecard silently showed
-- zeros. Deployed here with fixes:
--   * SECURITY INVOKER (RLS applies; the original DEFINER versions would have exposed
--     company-wide figures to any caller) with a pinned search_path, no anon access
--   * outstanding = amount_due - amount_paid on confirmed bookings only
--   * total_collected computed (was hard-coded 0); visits = completed visits
--   * "today"/months in IST rather than UTC

create or replace function public.get_booking_stats()
returns json language sql stable security invoker set search_path = public, pg_temp as $$
  select json_build_object(
    'total',            count(*),
    'pending_approval', count(*) filter (where b.status = 'pending_approval'),
    'confirmed',        count(*) filter (where b.status = 'confirmed'),
    'cancelled',        count(*) filter (where b.status = 'cancelled'),
    'total_value',      coalesce(sum(b.total_sale_value) filter (where b.status = 'confirmed'), 0),
    'total_collected',  coalesce((
      select sum(p.amount_paid) from payments p join bookings pb on pb.id = p.booking_id
      where pb.status = 'confirmed'), 0)
  )
  from bookings b;
$$;

create or replace function public.get_exec_dashboard()
returns json language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare
  today      date := (now() at time zone 'Asia/Kolkata')::date;
  curr_start date := date_trunc('month', (now() at time zone 'Asia/Kolkata'))::date;
  curr_end   date := (date_trunc('month', (now() at time zone 'Asia/Kolkata')) + interval '1 month' - interval '1 day')::date;
  prev_start date := (date_trunc('month', (now() at time zone 'Asia/Kolkata')) - interval '1 month')::date;
  prev_end   date := ((date_trunc('month', (now() at time zone 'Asia/Kolkata')))::date - 1);
  result json;
begin
  select json_build_object(
    'currLeads',   (select count(*) from leads where is_active and (created_at at time zone 'Asia/Kolkata')::date between curr_start and curr_end),
    'prevLeads',   (select count(*) from leads where is_active and (created_at at time zone 'Asia/Kolkata')::date between prev_start and prev_end),
    'currVisits',  (select count(*) from site_visits where status = 'completed' and (visited_at at time zone 'Asia/Kolkata')::date between curr_start and curr_end),
    'prevVisits',  (select count(*) from site_visits where status = 'completed' and (visited_at at time zone 'Asia/Kolkata')::date between prev_start and prev_end),
    'currBookings',(select count(*) from bookings where status = 'confirmed' and booking_date between curr_start and curr_end),
    'prevBookings',(select count(*) from bookings where status = 'confirmed' and booking_date between prev_start and prev_end),
    'currRevenue', coalesce((select sum(total_sale_value) from bookings where status = 'confirmed' and booking_date between curr_start and curr_end), 0),
    'prevRevenue', coalesce((select sum(total_sale_value) from bookings where status = 'confirmed' and booking_date between prev_start and prev_end), 0),
    'currCollections', coalesce((select sum(amount_paid) from payments where amount_paid > 0 and paid_date between curr_start and curr_end), 0),
    'outstanding', coalesce((
      select sum(greatest(p.amount_due - coalesce(p.amount_paid, 0), 0))
      from payments p join bookings b on b.id = p.booking_id
      where p.status in ('pending', 'overdue') and b.status = 'confirmed'), 0)
  ) into result;
  return result;
end;
$$;

create or replace function public.get_loan_stats()
returns json language sql stable security invoker set search_path = public, pg_temp as $$
  select json_build_object(
    'totalApplications',   (select count(*) from loan_applications),
    'activeApplications',  (select count(*) from loan_applications where stage in ('eligibility_check','bank_selected','application_submitted','docs_submitted','sanction_received','disbursement')),
    'rejected',            (select count(*) from loan_applications where stage = 'rejected'),
    'totalSanctioned',     coalesce((select sum(sanctioned_amount) from loan_applications), 0),
    'totalDisbursed',      coalesce((select sum(actual_amount) from loan_disbursements where status = 'received'), 0),
    'pendingDisbursements',(select count(*) from loan_disbursements where status = 'pending'),
    'delayedDisbursements',(select count(*) from loan_disbursements where status = 'delayed'),
    'byStage', coalesce((
      select json_object_agg(stage, c) from (select stage, count(*) as c from loan_applications group by stage) s
    ), '{}'::json)
  );
$$;

create or replace function public.get_advisor_scorecard(p_from date default null, p_to date default null)
returns json language sql stable security invoker set search_path = public, pg_temp as $$
  select coalesce(json_agg(row_to_json(res)), '[]'::json)
  from (
    select
      p.id,
      p.full_name as name,
      p.designation,
      coalesce(p.monthly_target_bookings, 0) as "targetBookings",
      coalesce(p.monthly_target_revenue, 0)  as "targetRevenue",
      (select count(*) from leads l where l.assigned_to = p.id and l.is_active) as leads,
      (select count(*) from lead_activities a where a.performed_by = p.id and a.type = 'call'
         and (p_from is null or a.created_at::date >= p_from) and (p_to is null or a.created_at::date <= p_to)) as calls,
      (select count(*) from lead_activities a where a.performed_by = p.id and a.type = 'follow_up'
         and (p_from is null or a.created_at::date >= p_from) and (p_to is null or a.created_at::date <= p_to)) as "followUps",
      (select count(*) from site_visits v where coalesce(v.visited_by, v.accompanied_by) = p.id and v.status = 'completed'
         and (p_from is null or v.visited_at::date >= p_from) and (p_to is null or v.visited_at::date <= p_to)) as visits,
      (select count(*) from bookings b where b.advisor_id = p.id and b.status = 'confirmed'
         and (p_from is null or b.booking_date >= p_from) and (p_to is null or b.booking_date <= p_to)) as bookings,
      coalesce((select sum(b.total_sale_value) from bookings b where b.advisor_id = p.id and b.status = 'confirmed'
         and (p_from is null or b.booking_date >= p_from) and (p_to is null or b.booking_date <= p_to)), 0) as revenue
    from profiles p
    where p.is_active and p.role::text in ('admin', 'manager', 'sales_advisor', 'telecaller')
    order by bookings desc, revenue desc
  ) res;
$$;

revoke all on function public.get_booking_stats()           from public, anon;
revoke all on function public.get_exec_dashboard()          from public, anon;
revoke all on function public.get_loan_stats()              from public, anon;
revoke all on function public.get_advisor_scorecard(date, date) from public, anon;
grant execute on function public.get_booking_stats()           to authenticated;
grant execute on function public.get_exec_dashboard()          to authenticated;
grant execute on function public.get_loan_stats()              to authenticated;
grant execute on function public.get_advisor_scorecard(date, date) to authenticated;
