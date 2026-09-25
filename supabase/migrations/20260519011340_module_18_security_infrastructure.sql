
-- Enable pgcrypto for field-level encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Security columns on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS failed_login_count   integer   NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lockout_until         timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at         timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_ip         inet;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS two_factor_enabled    boolean   NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS two_factor_secret     text;     -- encrypted TOTP secret

-- IP whitelist table (admin-managed)
CREATE TABLE IF NOT EXISTS ip_whitelist (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address   inet NOT NULL,
  label        text,
  is_active    boolean NOT NULL DEFAULT true,
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Global IP whitelist toggle
CREATE TABLE IF NOT EXISTS security_settings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_whitelist_enabled    boolean NOT NULL DEFAULT false,
  max_failed_attempts     integer NOT NULL DEFAULT 5,
  lockout_minutes         integer NOT NULL DEFAULT 30,
  session_timeout_minutes integer NOT NULL DEFAULT 60,
  updated_by              uuid REFERENCES profiles(id),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Insert default security settings row
INSERT INTO security_settings (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;

-- User sessions table (for force-logout and single-device tracking)
CREATE TABLE IF NOT EXISTS user_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id      text NOT NULL UNIQUE,  -- Supabase session ID
  device_info     text,
  ip_address      inet,
  last_active_at  timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  is_active       boolean NOT NULL DEFAULT true,
  revoked_at      timestamptz,
  revoked_by      uuid REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, is_active);

-- RLS for security tables (admin only via service role)
ALTER TABLE ip_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages ip_whitelist" ON ip_whitelist USING (true);
CREATE POLICY "Service role manages security_settings" ON security_settings USING (true);
CREATE POLICY "Service role manages user_sessions" ON user_sessions USING (true);

-- Add metadata column to audit_logs for richer context
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Function to write audit log (callable from app server)
CREATE OR REPLACE FUNCTION write_audit_log(
  p_user_id    uuid,
  p_action     text,
  p_table_name text,
  p_record_id  uuid,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_metadata   jsonb DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, metadata)
  VALUES (p_user_id, p_action, p_table_name, p_record_id, p_old_values, p_new_values, p_ip_address, p_user_agent, p_metadata);
END;
$$;
