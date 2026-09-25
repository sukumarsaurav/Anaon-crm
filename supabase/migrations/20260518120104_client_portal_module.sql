
-- ── Construction updates (admin posts progress) ─────────────────────
CREATE TABLE IF NOT EXISTS construction_updates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title               text NOT NULL,
  description         text,
  milestone           text,
  percentage_complete numeric NOT NULL DEFAULT 0 CHECK (percentage_complete >= 0 AND percentage_complete <= 100),
  photos              jsonb DEFAULT '[]'::jsonb,
  update_date         date NOT NULL DEFAULT CURRENT_DATE,
  posted_by           uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_published        boolean NOT NULL DEFAULT false,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- ── OTP requests for portal auth ────────────────────────────────────
CREATE TABLE IF NOT EXISTS portal_otp_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text NOT NULL,
  otp_hash    text NOT NULL,
  expires_at  timestamptz NOT NULL,
  verified    boolean NOT NULL DEFAULT false,
  attempts    int NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- ── Portal sessions (cookie-based auth) ─────────────────────────────
CREATE TABLE IF NOT EXISTS portal_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- ── Payment extension requests ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_extension_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  payment_id      uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  booking_id      uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  reason          text NOT NULL,
  requested_date  date NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes     text,
  reviewed_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at     timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_construction_updates_project_id ON construction_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_construction_updates_published   ON construction_updates(is_published);
CREATE INDEX IF NOT EXISTS idx_portal_otp_phone                 ON portal_otp_requests(phone);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_token            ON portal_sessions(token);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_client_id        ON portal_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_ext_client_id            ON payment_extension_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_ext_status               ON payment_extension_requests(status);

-- ── RLS on construction_updates ──────────────────────────────────────
ALTER TABLE construction_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "construction_updates_staff_all" ON construction_updates
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','manager','sales_advisor')
  );

-- ── RLS on portal_sessions (service role only — API routes use service key) ──
-- Portal sessions are accessed via API routes with service role, no client-side RLS needed
ALTER TABLE portal_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_sessions_service_only" ON portal_sessions
  FOR ALL TO authenticated
  USING (false);

-- ── RLS on portal_otp_requests ───────────────────────────────────────
ALTER TABLE portal_otp_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_otp_service_only" ON portal_otp_requests
  FOR ALL TO authenticated
  USING (false);

-- ── RLS on payment_extension_requests ───────────────────────────────
ALTER TABLE payment_extension_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_ext_staff_all" ON payment_extension_requests
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','manager')
  );
