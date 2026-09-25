
ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS template_key text,
  ADD COLUMN IF NOT EXISTS run_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_fired_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;

ALTER TABLE automation_logs
  ADD COLUMN IF NOT EXISTS action_result jsonb,
  ADD COLUMN IF NOT EXISTS context_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS lead_name text,
  ADD COLUMN IF NOT EXISTS lead_phone text;

CREATE TABLE IF NOT EXISTS automation_pending_executions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id    uuid NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  trigger_record_type text,
  trigger_record_id   uuid,
  context_snapshot jsonb,
  scheduled_for    timestamptz NOT NULL,
  executed_at      timestamptz,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','executed','cancelled','failed')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE automation_pending_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage automation_pending_executions"
  ON automation_pending_executions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service manage automation_pending_executions"
  ON automation_pending_executions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_automation_pending_scheduled ON automation_pending_executions (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_executed_at ON automation_logs(executed_at);
CREATE INDEX IF NOT EXISTS idx_automations_trigger ON automations(trigger_event);
