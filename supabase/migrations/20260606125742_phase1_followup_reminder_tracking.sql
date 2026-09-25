-- Tracks when a reminder was last fired for the current next_followup_at,
-- so the cron does not re-notify on every run. Reset to NULL when a new
-- follow-up is scheduled.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS followup_reminder_sent_at timestamptz;

-- Index to make the overdue/due scan cheap
CREATE INDEX IF NOT EXISTS idx_leads_next_followup_active
  ON leads (next_followup_at)
  WHERE is_active = true;