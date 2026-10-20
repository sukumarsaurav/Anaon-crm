-- Security: the write policies below were `USING (true)` for every signed-in user. Brokers (and
-- anyone holding a login) are `authenticated`, so they could read payroll and edit loans,
-- automations and templates straight through the REST API. Replaced with role checks that match
-- what the app's server actions already enforce (admin/manager for config, money and HR;
-- staff for day-to-day records).

create or replace function public.current_user_is_staff()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active
      and role::text in ('admin','manager','sales_advisor','telecaller')
  );
$$;
revoke all on function public.current_user_is_staff() from public, anon;
grant execute on function public.current_user_is_staff() to authenticated;

-- Broker accounts are created server-side with app_metadata.role = 'broker' (only the service
-- role can set it); everyone else keeps the old default.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    case when new.raw_app_meta_data->>'role' = 'broker' then 'broker'::public.user_role
         else 'sales_advisor'::public.user_role end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- assignment_rules
drop policy if exists "assignment_rules_write_authenticated" on public.assignment_rules;
create policy "assignment_rules_select_staff" on public.assignment_rules for select to authenticated using (public.current_user_is_staff());
create policy "assignment_rules_insert_mgr" on public.assignment_rules for insert to authenticated with check (public.current_user_is_admin_or_manager());
create policy "assignment_rules_update_mgr" on public.assignment_rules for update to authenticated using (public.current_user_is_admin_or_manager()) with check (public.current_user_is_admin_or_manager());
create policy "assignment_rules_delete_mgr" on public.assignment_rules for delete to authenticated using (public.current_user_is_admin_or_manager());
-- automations
drop policy if exists "automations_write_authenticated" on public.automations;
create policy "automations_select_staff" on public.automations for select to authenticated using (public.current_user_is_staff());
create policy "automations_insert_mgr" on public.automations for insert to authenticated with check (public.current_user_is_admin_or_manager());
create policy "automations_update_mgr" on public.automations for update to authenticated using (public.current_user_is_admin_or_manager()) with check (public.current_user_is_admin_or_manager());
create policy "automations_delete_mgr" on public.automations for delete to authenticated using (public.current_user_is_admin_or_manager());
-- automation_pending_executions
drop policy if exists "Authenticated manage automation_pending_executions" on public.automation_pending_executions;
create policy "automation_pending_executions_select_staff" on public.automation_pending_executions for select to authenticated using (public.current_user_is_staff());
create policy "automation_pending_executions_insert_mgr" on public.automation_pending_executions for insert to authenticated with check (public.current_user_is_admin_or_manager());
create policy "automation_pending_executions_update_mgr" on public.automation_pending_executions for update to authenticated using (public.current_user_is_admin_or_manager()) with check (public.current_user_is_admin_or_manager());
create policy "automation_pending_executions_delete_mgr" on public.automation_pending_executions for delete to authenticated using (public.current_user_is_admin_or_manager());
-- auto_reply_rules
drop policy if exists "auto_reply_rules_write" on public.auto_reply_rules;
drop policy if exists "auto_reply_rules_anon_read" on public.auto_reply_rules;
create policy "auto_reply_rules_select_staff" on public.auto_reply_rules for select to authenticated using (public.current_user_is_staff());
create policy "auto_reply_rules_insert_mgr" on public.auto_reply_rules for insert to authenticated with check (public.current_user_is_admin_or_manager());
create policy "auto_reply_rules_update_mgr" on public.auto_reply_rules for update to authenticated using (public.current_user_is_admin_or_manager()) with check (public.current_user_is_admin_or_manager());
create policy "auto_reply_rules_delete_mgr" on public.auto_reply_rules for delete to authenticated using (public.current_user_is_admin_or_manager());
-- whatsapp_templates
drop policy if exists "wa_templates_write_authenticated" on public.whatsapp_templates;
create policy "whatsapp_templates_select_staff" on public.whatsapp_templates for select to authenticated using (public.current_user_is_staff());
create policy "whatsapp_templates_insert_mgr" on public.whatsapp_templates for insert to authenticated with check (public.current_user_is_admin_or_manager());
create policy "whatsapp_templates_update_mgr" on public.whatsapp_templates for update to authenticated using (public.current_user_is_admin_or_manager()) with check (public.current_user_is_admin_or_manager());
create policy "whatsapp_templates_delete_mgr" on public.whatsapp_templates for delete to authenticated using (public.current_user_is_admin_or_manager());
-- whatsapp_broadcasts
drop policy if exists "wa_broadcasts_write_authenticated" on public.whatsapp_broadcasts;
create policy "whatsapp_broadcasts_select_staff" on public.whatsapp_broadcasts for select to authenticated using (public.current_user_is_staff());
create policy "whatsapp_broadcasts_insert_mgr" on public.whatsapp_broadcasts for insert to authenticated with check (public.current_user_is_admin_or_manager());
create policy "whatsapp_broadcasts_update_mgr" on public.whatsapp_broadcasts for update to authenticated using (public.current_user_is_admin_or_manager()) with check (public.current_user_is_admin_or_manager());
create policy "whatsapp_broadcasts_delete_mgr" on public.whatsapp_broadcasts for delete to authenticated using (public.current_user_is_admin_or_manager());
-- whatsapp_broadcast_recipients
drop policy if exists "wa_broadcast_recipients_write" on public.whatsapp_broadcast_recipients;
create policy "whatsapp_broadcast_recipients_select_staff" on public.whatsapp_broadcast_recipients for select to authenticated using (public.current_user_is_staff());
create policy "whatsapp_broadcast_recipients_insert_mgr" on public.whatsapp_broadcast_recipients for insert to authenticated with check (public.current_user_is_admin_or_manager());
create policy "whatsapp_broadcast_recipients_update_mgr" on public.whatsapp_broadcast_recipients for update to authenticated using (public.current_user_is_admin_or_manager()) with check (public.current_user_is_admin_or_manager());
create policy "whatsapp_broadcast_recipients_delete_mgr" on public.whatsapp_broadcast_recipients for delete to authenticated using (public.current_user_is_admin_or_manager());
-- marketing_campaigns
drop policy if exists "Authenticated users can manage marketing_campaigns" on public.marketing_campaigns;
create policy "marketing_campaigns_select_staff" on public.marketing_campaigns for select to authenticated using (public.current_user_is_staff());
create policy "marketing_campaigns_insert_mgr" on public.marketing_campaigns for insert to authenticated with check (public.current_user_is_admin_or_manager());
create policy "marketing_campaigns_update_mgr" on public.marketing_campaigns for update to authenticated using (public.current_user_is_admin_or_manager()) with check (public.current_user_is_admin_or_manager());
create policy "marketing_campaigns_delete_mgr" on public.marketing_campaigns for delete to authenticated using (public.current_user_is_admin_or_manager());
-- campaign_spend_logs
drop policy if exists "Authenticated users can manage campaign_spend_logs" on public.campaign_spend_logs;
create policy "campaign_spend_logs_select_staff" on public.campaign_spend_logs for select to authenticated using (public.current_user_is_staff());
create policy "campaign_spend_logs_insert_mgr" on public.campaign_spend_logs for insert to authenticated with check (public.current_user_is_admin_or_manager());
create policy "campaign_spend_logs_update_mgr" on public.campaign_spend_logs for update to authenticated using (public.current_user_is_admin_or_manager()) with check (public.current_user_is_admin_or_manager());
create policy "campaign_spend_logs_delete_mgr" on public.campaign_spend_logs for delete to authenticated using (public.current_user_is_admin_or_manager());
-- teams
drop policy if exists "teams_write_authenticated" on public.teams;
create policy "teams_select_staff" on public.teams for select to authenticated using (public.current_user_is_staff());
create policy "teams_insert_mgr" on public.teams for insert to authenticated with check (public.current_user_is_admin_or_manager());
create policy "teams_update_mgr" on public.teams for update to authenticated using (public.current_user_is_admin_or_manager()) with check (public.current_user_is_admin_or_manager());
create policy "teams_delete_mgr" on public.teams for delete to authenticated using (public.current_user_is_admin_or_manager());
-- property_albums
drop policy if exists "property_albums_write_authenticated" on public.property_albums;
create policy "property_albums_select_staff" on public.property_albums for select to authenticated using (public.current_user_is_staff());
create policy "property_albums_insert_staff" on public.property_albums for insert to authenticated with check (public.current_user_is_staff());
create policy "property_albums_update_staff" on public.property_albums for update to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
create policy "property_albums_delete_staff" on public.property_albums for delete to authenticated using (public.current_user_is_staff());
-- loan_applications
drop policy if exists "loan_apps_write" on public.loan_applications;
create policy "loan_applications_select_staff" on public.loan_applications for select to authenticated using (public.current_user_is_staff());
create policy "loan_applications_insert_staff" on public.loan_applications for insert to authenticated with check (public.current_user_is_staff());
create policy "loan_applications_update_staff" on public.loan_applications for update to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
create policy "loan_applications_delete_staff" on public.loan_applications for delete to authenticated using (public.current_user_is_staff());
-- loan_disbursements
drop policy if exists "loan_disb_write" on public.loan_disbursements;
create policy "loan_disbursements_select_staff" on public.loan_disbursements for select to authenticated using (public.current_user_is_staff());
create policy "loan_disbursements_insert_staff" on public.loan_disbursements for insert to authenticated with check (public.current_user_is_staff());
create policy "loan_disbursements_update_staff" on public.loan_disbursements for update to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
create policy "loan_disbursements_delete_staff" on public.loan_disbursements for delete to authenticated using (public.current_user_is_staff());
-- construction_milestones
drop policy if exists "milestones_write_authenticated" on public.construction_milestones;
create policy "construction_milestones_select_staff" on public.construction_milestones for select to authenticated using (public.current_user_is_staff());
create policy "construction_milestones_insert_staff" on public.construction_milestones for insert to authenticated with check (public.current_user_is_staff());
create policy "construction_milestones_update_staff" on public.construction_milestones for update to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
create policy "construction_milestones_delete_staff" on public.construction_milestones for delete to authenticated using (public.current_user_is_staff());
-- whatsapp_conversations
drop policy if exists "wa_conversations_write_authenticated" on public.whatsapp_conversations;
create policy "whatsapp_conversations_select_staff" on public.whatsapp_conversations for select to authenticated using (public.current_user_is_staff());
create policy "whatsapp_conversations_insert_staff" on public.whatsapp_conversations for insert to authenticated with check (public.current_user_is_staff());
create policy "whatsapp_conversations_update_staff" on public.whatsapp_conversations for update to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
create policy "whatsapp_conversations_delete_staff" on public.whatsapp_conversations for delete to authenticated using (public.current_user_is_staff());
-- developers
drop policy if exists "developers_write_auth" on public.developers;
create policy "developers_insert_mgr" on public.developers for insert to authenticated with check (public.current_user_is_admin_or_manager());
create policy "developers_update_mgr" on public.developers for update to authenticated using (public.current_user_is_admin_or_manager()) with check (public.current_user_is_admin_or_manager());
create policy "developers_delete_mgr" on public.developers for delete to authenticated using (public.current_user_is_admin_or_manager());
-- team_members
drop policy if exists "team_members_write_auth" on public.team_members;
create policy "team_members_insert_mgr" on public.team_members for insert to authenticated with check (public.current_user_is_admin_or_manager());
create policy "team_members_update_mgr" on public.team_members for update to authenticated using (public.current_user_is_admin_or_manager()) with check (public.current_user_is_admin_or_manager());
create policy "team_members_delete_mgr" on public.team_members for delete to authenticated using (public.current_user_is_admin_or_manager());

-- complaints: the 'active profile' policies matched broker profiles too
drop policy if exists "complaints_write_authenticated" on public.complaints;
drop policy if exists "team_read_complaints" on public.complaints;
drop policy if exists "team_write_complaints" on public.complaints;
create policy "complaints_staff_all" on public.complaints for all to authenticated
  using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- chatbot_sessions: anon could read/write every WhatsApp bot session (phone numbers, context).
-- The code only touches it with the service client.
drop policy if exists "chatbot_sessions_anon" on public.chatbot_sessions;
drop policy if exists "chatbot_sessions_write" on public.chatbot_sessions;
create policy "chatbot_sessions_staff_all" on public.chatbot_sessions for all to authenticated
  using (public.current_user_is_staff()) with check (public.current_user_is_staff());

-- HR / payroll: managers only; an employee may read their own slip and balance
drop policy if exists "Authenticated manage payroll_runs" on public.payroll_runs;
create policy "payroll_runs_mgr_all" on public.payroll_runs for all to authenticated
  using (public.current_user_is_admin_or_manager()) with check (public.current_user_is_admin_or_manager());

drop policy if exists "Authenticated manage payroll_slips" on public.payroll_slips;
create policy "payroll_slips_mgr_all" on public.payroll_slips for all to authenticated
  using (public.current_user_is_admin_or_manager()) with check (public.current_user_is_admin_or_manager());
create policy "payroll_slips_own_select" on public.payroll_slips for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Authenticated manage hr_leave_balances" on public.hr_leave_balances;
create policy "hr_leave_balances_mgr_all" on public.hr_leave_balances for all to authenticated
  using (public.current_user_is_admin_or_manager()) with check (public.current_user_is_admin_or_manager());
create policy "hr_leave_balances_own_select" on public.hr_leave_balances for select to authenticated
  using (user_id = (select auth.uid()));

-- Inserts: staff only (brokers register leads through broker_lead_registrations instead)
drop policy if exists "leads_insert_authenticated" on public.leads;
create policy "leads_insert_staff" on public.leads for insert to authenticated with check (public.current_user_is_staff());

drop policy if exists "lead_activities_insert_authenticated" on public.lead_activities;
create policy "lead_activities_insert_staff" on public.lead_activities for insert to authenticated with check (public.current_user_is_staff());

drop policy if exists "notifications_insert_authenticated" on public.notifications;
create policy "notifications_insert_staff" on public.notifications for insert to authenticated with check (public.current_user_is_staff());

drop policy if exists "audit_logs_insert_authenticated" on public.audit_logs;
create policy "audit_logs_insert_staff" on public.audit_logs for insert to authenticated with check (public.current_user_is_staff());
drop policy if exists "audit_logs_read_authenticated" on public.audit_logs;
create policy "audit_logs_read_mgr" on public.audit_logs for select to authenticated using (public.current_user_is_admin_or_manager());

drop policy if exists "automation_logs_insert_authenticated" on public.automation_logs;
create policy "automation_logs_insert_staff" on public.automation_logs for insert to authenticated with check (public.current_user_is_staff());
drop policy if exists "automation_logs_read_authenticated" on public.automation_logs;
create policy "automation_logs_read_staff" on public.automation_logs for select to authenticated using (public.current_user_is_staff());

drop policy if exists "consent_logs_insert" on public.consent_logs;
create policy "consent_logs_insert_staff" on public.consent_logs for insert to authenticated with check (public.current_user_is_staff());

drop policy if exists "deletion_requests_insert" on public.data_deletion_requests;
create policy "deletion_requests_insert_staff" on public.data_deletion_requests for insert to authenticated with check (public.current_user_is_staff());

drop policy if exists "broker_commissions_insert_authenticated" on public.broker_commissions;
create policy "broker_commissions_insert_staff" on public.broker_commissions for insert to authenticated with check (public.current_user_is_staff());

drop policy if exists "brokers_insert_authenticated" on public.brokers;
create policy "brokers_insert_mgr" on public.brokers for insert to authenticated with check (public.current_user_is_admin_or_manager());

drop policy if exists "site_visits_insert_authenticated" on public.site_visits;
drop policy if exists "site_visits_update_authenticated" on public.site_visits;
create policy "site_visits_insert_staff" on public.site_visits for insert to authenticated with check (public.current_user_is_staff());
create policy "site_visits_update_staff" on public.site_visits for update to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());

drop policy if exists "wa_messages_insert_authenticated" on public.whatsapp_messages;
drop policy if exists "wa_messages_update_authenticated" on public.whatsapp_messages;
drop policy if exists "wa_messages_read_authenticated" on public.whatsapp_messages;
create policy "wa_messages_insert_staff" on public.whatsapp_messages for insert to authenticated with check (public.current_user_is_staff());
create policy "wa_messages_update_staff" on public.whatsapp_messages for update to authenticated using (public.current_user_is_staff()) with check (public.current_user_is_staff());
create policy "wa_messages_read_staff" on public.whatsapp_messages for select to authenticated using (public.current_user_is_staff());

drop policy if exists "Authenticated users can view meta webhook events" on public.meta_lead_webhook_events;
create policy "meta_webhook_events_read_mgr" on public.meta_lead_webhook_events for select to authenticated using (public.current_user_is_admin_or_manager());
