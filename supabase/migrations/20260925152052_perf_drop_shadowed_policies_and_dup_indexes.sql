-- Permissive RLS policies are OR'd, so every one of these was evaluated per row
-- while granting nothing the table did not already grant to the same role.
--
-- Each policy dropped here is fully shadowed by another policy on the same
-- table for the same role (`authenticated`):
--   * those with USING (true) sit alongside an ALL policy that is also
--     USING (true), which already permits SELECT;
--   * plots/projects/price_escalations used `auth.uid() IS NOT NULL`, which is
--     strictly narrower than the sibling `_read_authenticated` policy's `true`
--     (and always satisfied for the `authenticated` role anyway).
--
-- Access is therefore unchanged. Policies serving `anon` are left alone — the
-- public website depends on projects_public_read_active and plots_public_read.

drop policy if exists "assignment_rules_read_authenticated" on public.assignment_rules;
drop policy if exists "auto_reply_rules_read"               on public.auto_reply_rules;
drop policy if exists "automations_read_authenticated"      on public.automations;
drop policy if exists "chatbot_sessions_read"               on public.chatbot_sessions;
drop policy if exists "complaints_read_authenticated"       on public.complaints;
drop policy if exists "milestones_read_authenticated"       on public.construction_milestones;
drop policy if exists "Authenticated read hr_leave_balances" on public.hr_leave_balances;
drop policy if exists "loan_apps_read"                      on public.loan_applications;
drop policy if exists "loan_disb_read"                      on public.loan_disbursements;
drop policy if exists "Authenticated read payroll_runs"     on public.payroll_runs;
drop policy if exists "Authenticated read payroll_slips"    on public.payroll_slips;
drop policy if exists "property_albums_read_authenticated"  on public.property_albums;
drop policy if exists "teams_read_authenticated"            on public.teams;
drop policy if exists "wa_broadcast_recipients_read"        on public.whatsapp_broadcast_recipients;
drop policy if exists "wa_broadcasts_read_authenticated"    on public.whatsapp_broadcasts;
drop policy if exists "wa_conversations_read_authenticated" on public.whatsapp_conversations;
drop policy if exists "wa_templates_read_authenticated"     on public.whatsapp_templates;
drop policy if exists "projects_read"                       on public.projects;
drop policy if exists "plots_read"                          on public.plots;
drop policy if exists "price_esc_read"                      on public.price_escalations;

-- Non-unique indexes duplicating the index behind a UNIQUE constraint on the
-- same columns. The unique index answers the same lookups; these only cost
-- write throughput and storage.
drop index if exists public.idx_attendance_user_date;
drop index if exists public.idx_blog_posts_slug;
drop index if exists public.idx_brokers_auth_user_id;
drop index if exists public.idx_meta_webhook_event_id;
drop index if exists public.idx_payroll_runs_year_month;
drop index if exists public.idx_portal_sessions_token;
drop index if exists public.idx_wa_messages_wa_id;
