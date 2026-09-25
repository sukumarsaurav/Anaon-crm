
-- Attendance table for field agent GPS check-in/out
CREATE TABLE IF NOT EXISTS attendance (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  check_in_time    timestamptz NOT NULL DEFAULT now(),
  check_out_time   timestamptz,
  check_in_lat     numeric,
  check_in_lng     numeric,
  check_out_lat    numeric,
  check_out_lng    numeric,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, check_in_time);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own attendance" ON attendance
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own attendance" ON attendance
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own attendance" ON attendance
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on attendance" ON attendance
  USING (auth.jwt()->>'role' = 'service_role');

-- Add action_url to notifications if not exists
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url text;

-- Add visited_by and outcome columns to site_visits for mobile field visits
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS visited_by uuid REFERENCES profiles(id);
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS visit_date timestamptz;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS outcome text;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS notes text;
