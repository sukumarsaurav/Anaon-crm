
-- ── Extend brokers table ────────────────────────────────────────────
ALTER TABLE brokers
  ADD COLUMN IF NOT EXISTS email            text,
  ADD COLUMN IF NOT EXISTS city             text,
  ADD COLUMN IF NOT EXISTS address          text,
  ADD COLUMN IF NOT EXISTS rera_number      text,
  ADD COLUMN IF NOT EXISTS bank_name        text,
  ADD COLUMN IF NOT EXISTS account_number   text,
  ADD COLUMN IF NOT EXISTS ifsc             text,
  ADD COLUMN IF NOT EXISTS gstin            text,
  ADD COLUMN IF NOT EXISTS invited_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_reason  text,
  ADD COLUMN IF NOT EXISTS auth_user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE,
  ADD COLUMN IF NOT EXISTS onboarded_at     timestamptz,
  ADD COLUMN IF NOT EXISTS notes            text,
  ADD COLUMN IF NOT EXISTS created_at       timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz DEFAULT now();

-- ── Broker lead registrations ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS broker_lead_registrations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id             uuid NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  client_name           text NOT NULL,
  client_phone          text NOT NULL,
  project_id            uuid REFERENCES projects(id) ON DELETE SET NULL,
  budget_min            numeric,
  budget_max            numeric,
  notes                 text,
  status                text NOT NULL DEFAULT 'registered'
                        CHECK (status IN ('registered', 'duplicate', 'converted', 'lost')),
  crm_lead_id           uuid REFERENCES leads(id) ON DELETE SET NULL,
  duplicate_of_lead_id  uuid REFERENCES leads(id) ON DELETE SET NULL,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_brokers_status       ON brokers(status);
CREATE INDEX IF NOT EXISTS idx_brokers_auth_user_id ON brokers(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_broker_lead_regs_broker_id   ON broker_lead_registrations(broker_id);
CREATE INDEX IF NOT EXISTS idx_broker_lead_regs_crm_lead_id ON broker_lead_registrations(crm_lead_id);
CREATE INDEX IF NOT EXISTS idx_broker_lead_regs_phone        ON broker_lead_registrations(client_phone);

-- ── RLS on brokers ─────────────────────────────────────────────────
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brokers_admin_all" ON brokers
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','manager')
  );

CREATE POLICY "brokers_self_select" ON brokers
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- ── RLS on broker_lead_registrations ───────────────────────────────
ALTER TABLE broker_lead_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broker_leads_admin_all" ON broker_lead_registrations
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','manager')
  );

CREATE POLICY "broker_leads_own_select" ON broker_lead_registrations
  FOR SELECT TO authenticated
  USING (
    broker_id = (SELECT id FROM brokers WHERE auth_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "broker_leads_own_insert" ON broker_lead_registrations
  FOR INSERT TO authenticated
  WITH CHECK (
    broker_id = (SELECT id FROM brokers WHERE auth_user_id = auth.uid() LIMIT 1)
  );

-- ── RLS on broker_commissions ───────────────────────────────────────
ALTER TABLE broker_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broker_commissions_admin_all" ON broker_commissions
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin','manager')
  );

CREATE POLICY "broker_commissions_own_select" ON broker_commissions
  FOR SELECT TO authenticated
  USING (
    broker_id = (SELECT id FROM brokers WHERE auth_user_id = auth.uid() LIMIT 1)
  );
