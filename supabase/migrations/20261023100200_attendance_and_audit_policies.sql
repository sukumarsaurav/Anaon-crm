-- Menu audit 2026-10-20, phase 2.

-- Managers correcting attendance ("Mark attendance") upsert other people's rows; the insert policy only
-- allowed your own row, so a manager could fix an existing day but never record a missing one.
drop policy if exists attendance_insert on public.attendance_logs;
create policy attendance_insert on public.attendance_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id or public.current_user_is_admin_or_manager());

-- Audit entries are written by the server with the service role (lib/security/audit.ts). Letting any
-- staff session insert meant entries could be forged in someone else's name through the REST API.
drop policy if exists audit_logs_insert_staff on public.audit_logs;
