-- Two-factor authentication was removed from the app in c0d46f0 (routes, pages, proxy gate). The
-- profile columns stayed behind; nobody had it enabled and no secrets were stored. Drop them, and
-- stop referencing them in the self-edit guard first.

create or replace function public.profiles_freeze_privileged_self()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id then
    if new.role                 is distinct from old.role
    or new.is_active            is distinct from old.is_active
    or new.branch_id            is distinct from old.branch_id
    or new.reporting_manager_id is distinct from old.reporting_manager_id
    or new.failed_login_count   is distinct from old.failed_login_count
    or new.lockout_until        is distinct from old.lockout_until
    or new.last_failed_login_at is distinct from old.last_failed_login_at
    then
      raise exception 'Not allowed to modify privileged profile fields on your own account'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

alter table public.profiles drop column if exists two_factor_enabled;
alter table public.profiles drop column if exists two_factor_secret;
