-- In a BEFORE trigger NEW.total_price (a generated column) is not computed yet, so comparing whole
-- rows always saw a "change" and blocked every advisor hold. total_price derives from columns that
-- are already compared, so leaving it out loses nothing.
create or replace function public.plots_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  ignored constant text[] := array['status', 'held_by', 'held_until', 'updated_at', 'total_price'];
begin
  if public.current_session_is_privileged() then
    return new;
  end if;

  if (to_jsonb(new) - ignored) is distinct from (to_jsonb(old) - ignored) then
    raise exception 'Only a manager can edit plot details or prices' using errcode = '42501';
  end if;

  if new.status = 'soft_hold' then
    if new.held_by is distinct from auth.uid() then
      raise exception 'A hold must be in your own name' using errcode = '42501';
    end if;
    if not (old.status = 'available' or (old.status = 'soft_hold' and old.held_by = auth.uid())) then
      raise exception 'This plot is not available' using errcode = '42501';
    end if;
  elsif new.status = 'available' then
    if not (old.status = 'available' or (old.status = 'soft_hold' and old.held_by = auth.uid())) then
      raise exception 'You can only release your own hold' using errcode = '42501';
    end if;
  elsif new.status is distinct from old.status then
    raise exception 'Only a manager can change a plot to %', new.status using errcode = '42501';
  end if;
  return new;
end;
$$;
