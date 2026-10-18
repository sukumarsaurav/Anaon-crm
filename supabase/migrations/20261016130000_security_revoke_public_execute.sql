-- APPLY TOGETHER WITH THE DEPLOY of the code that calls portal_* as service_role
-- (crm/src/lib/portal/{actions,session}.ts). Applying it before that deploy breaks
-- client-portal login on the old code; delaying it leaves the hole below open.
--
-- 1. Postgres grants EXECUTE on every new function to PUBLIC. The earlier migration
--    (security_revoke_execute_internal_functions) revoked from anon and authenticated
--    only, so the PUBLIC grant kept every one of these callable over /rest/v1/rpc —
--    write_audit_log included. Revoke from PUBLIC as well.
--
-- 2. The portal_* functions are SECURITY DEFINER and trust their arguments.
--    portal_create_otp takes the OTP *hash* from the caller: with the public anon key,
--    anyone could store a hash of a code they chose for any client's phone, then call
--    portal_verify_otp with it and receive a 30-day portal session as that client.
--    The app now calls them only as service_role.

do $$
declare f text;
begin
  foreach f in array array[
    'public.write_audit_log(uuid, text, text, uuid, jsonb, jsonb, inet, text, jsonb)',
    'public.handle_new_user()',
    'public.profiles_freeze_privileged_self()',
    'public.release_expired_holds()',
    'public.sync_lead_temperature()',
    'public.teams_prevent_cycle()',
    'public.update_updated_at_column()',
    'public.update_updated_at()',
    'public.portal_check_session(text)',
    'public.portal_create_complaint(uuid, uuid, text, text)',
    'public.portal_create_extension_request(uuid, uuid, uuid, text, date)',
    'public.portal_create_otp(text, text, timestamptz)',
    'public.portal_delete_session(text)',
    'public.portal_verify_otp(text, text)',
    'public.record_album_view(text, text, text)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', f);
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end $$;

-- RLS policies call these as the signed-in user, so authenticated keeps EXECUTE;
-- nobody signed out needs them.
revoke execute on function public.current_user_visible_members()    from public, anon;
revoke execute on function public.current_user_is_admin_or_manager() from public, anon;
grant  execute on function public.current_user_visible_members()    to authenticated, service_role;
grant  execute on function public.current_user_is_admin_or_manager() to authenticated, service_role;
