
-- Automation rules
CREATE TABLE automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,   -- e.g. 'lead_created', 'stage_changed', 'payment_due'
  conditions JSONB DEFAULT '{}',  -- filter conditions
  delay_value INTEGER DEFAULT 0,
  delay_unit TEXT DEFAULT 'minutes' CHECK (delay_unit IN ('minutes', 'hours', 'days')),
  action_type TEXT NOT NULL CHECK (action_type IN (
    'send_whatsapp', 'send_sms', 'send_email',
    'create_followup', 'send_push', 'change_stage', 'assign_lead', 'add_tag'
  )),
  action_payload JSONB DEFAULT '{}',  -- template ID, message, etc.
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automation execution log
CREATE TABLE automation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID NOT NULL REFERENCES automations(id),
  trigger_record_type TEXT,  -- 'lead', 'client', 'booking'
  trigger_record_id UUID,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit trail (immutable — no UPDATE/DELETE policies)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,   -- 'create', 'update', 'delete', 'view', 'export', 'login'
  table_name TEXT,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL,    -- 'lead_assigned', 'followup_due', 'sla_breach', etc.
  related_record_type TEXT,
  related_record_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automations_read_authenticated" ON automations FOR SELECT TO authenticated USING (true);
CREATE POLICY "automations_write_authenticated" ON automations FOR ALL TO authenticated USING (true);
CREATE POLICY "automation_logs_read_authenticated" ON automation_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "automation_logs_insert_authenticated" ON automation_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Audit logs: insert only, no update/delete
CREATE POLICY "audit_logs_insert_authenticated" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "audit_logs_read_authenticated" ON audit_logs FOR SELECT TO authenticated USING (true);

-- Notifications: users see only their own
CREATE POLICY "notifications_read_own" ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notifications_insert_authenticated" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
