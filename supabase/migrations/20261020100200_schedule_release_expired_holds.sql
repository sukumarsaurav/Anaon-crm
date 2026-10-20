create extension if not exists pg_cron with schema pg_catalog;

-- release_expired_holds() existed but nothing ever called it, so soft holds never expired.
create or replace function public.release_expired_holds()
returns void language plpgsql set search_path = public, pg_temp as $$
begin
  update plots
     set status = 'available', held_by = null, held_until = null, updated_at = now()
   where status = 'soft_hold' and held_until < now();
end;
$$;

select cron.schedule('release-expired-plot-holds', '*/15 * * * *', $cron$select public.release_expired_holds()$cron$);
