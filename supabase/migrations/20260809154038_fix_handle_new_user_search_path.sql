-- handle_new_user() is SECURITY DEFINER with no search_path and an unqualified
-- `profiles` reference. GoTrue's connection does not have `public` on its
-- search_path, so the INSERT could not resolve the table and every new-user
-- creation failed with "Database error creating new user".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email)
  on conflict (id) do nothing;
  return new;
end;
$function$;