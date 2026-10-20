-- The scheduled hold release now also: leaves plots with a booking awaiting approval alone, and
-- closes the matching plot_holds_log rows (outcome 'expired') instead of leaving them open forever.
create or replace function public.release_expired_holds()
returns void language plpgsql set search_path = public, pg_temp as $$
begin
  with freed as (
    update plots p
       set status = 'available', held_by = null, held_until = null, updated_at = now()
     where p.status = 'soft_hold' and p.held_until < now()
       and not exists (select 1 from bookings b where b.plot_id = p.id and b.status = 'pending_approval')
    returning p.id
  )
  update plot_holds_log l
     set released_at = now(), outcome = 'expired'
   where l.plot_id in (select id from freed) and l.released_at is null;
end;
$$;
