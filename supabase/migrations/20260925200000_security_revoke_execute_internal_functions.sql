-- These SECURITY DEFINER functions were exposed as PostgREST RPCs to anon and
-- authenticated. They are trigger/maintenance/internal helpers the client never
-- calls directly (verified: no .rpc() references in the app), and one —
-- write_audit_log — let anyone forge or flood audit-log entries via
-- /rest/v1/rpc/write_audit_log. Revoke EXECUTE so they can't be called over the
-- API. Trigger firing is unaffected (triggers don't require caller EXECUTE), and
-- service-role callers bypass grants.
--
-- Intentionally left callable: portal_* and record_album_view (the public
-- client-portal + album-tracking surface), and current_user_visible_members /
-- current_user_is_admin_or_manager (referenced inside RLS policies that
-- authenticated users must be able to evaluate).

revoke execute on function public.write_audit_log(uuid, text, text, uuid, jsonb, jsonb, inet, text, jsonb) from anon, authenticated;
revoke execute on function public.handle_new_user()                 from anon, authenticated;
revoke execute on function public.profiles_freeze_privileged_self() from anon, authenticated;
revoke execute on function public.release_expired_holds()           from anon, authenticated;
revoke execute on function public.sync_lead_temperature()           from anon, authenticated;
revoke execute on function public.teams_prevent_cycle()             from anon, authenticated;
revoke execute on function public.update_updated_at_column()        from anon, authenticated;
revoke execute on function public.update_updated_at()               from anon, authenticated;
