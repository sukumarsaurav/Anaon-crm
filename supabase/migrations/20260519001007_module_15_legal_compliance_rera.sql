
-- ── Extend projects with RERA disclosure fields ────────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS rera_authority_name         TEXT,
  ADD COLUMN IF NOT EXISTS rera_website_url            TEXT,
  ADD COLUMN IF NOT EXISTS carpet_area_sqft            NUMERIC,
  ADD COLUMN IF NOT EXISTS fsi_approved                NUMERIC,
  ADD COLUMN IF NOT EXISTS total_approved_units        INTEGER,
  ADD COLUMN IF NOT EXISTS quarterly_report_last_submitted DATE,
  ADD COLUMN IF NOT EXISTS quarterly_report_due_date   DATE,
  ADD COLUMN IF NOT EXISTS rera_disclosures            JSONB DEFAULT '{}';

-- ── Legal document templates ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS legal_document_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,  -- booking_form | ats | allotment_letter | demand_letter | cancellation_letter | possession_letter | handover_checklist | noc_bank | other
  description   TEXT,
  file_url      TEXT,
  version       TEXT DEFAULT '1.0',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Data deletion requests (DPDP Act compliance) ───────────────────────────
CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_type   TEXT NOT NULL CHECK (requester_type IN ('lead','client')),
  requester_id     UUID,           -- lead_id or client_id (nullable for external requests)
  requester_name   TEXT NOT NULL,
  requester_phone  TEXT,
  requester_email  TEXT,
  reason           TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','in_progress','completed','rejected')),
  admin_notes      TEXT,
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  processed_by     UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- ── Consent logs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consent_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL CHECK (entity_type IN ('lead','client')),
  entity_id     UUID NOT NULL,
  entity_name   TEXT,
  consent_type  TEXT NOT NULL,  -- marketing_whatsapp | marketing_email | data_storage | site_visit_photos
  consented     BOOLEAN NOT NULL DEFAULT TRUE,
  ip_address    TEXT,
  source        TEXT DEFAULT 'crm',  -- crm | web | whatsapp
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_legal_templates_type ON legal_document_templates (type);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON data_deletion_requests (status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_logs_entity ON consent_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_rera_expiry ON projects (rera_expiry_date) WHERE rera_expiry_date IS NOT NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE legal_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_logs ENABLE ROW LEVEL SECURITY;

-- Templates: authenticated users can read; admin/manager/legal can write
CREATE POLICY "legal_templates_read" ON legal_document_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "legal_templates_write" ON legal_document_templates
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  );

-- Deletion requests: admin/manager can manage; anyone authenticated can insert
CREATE POLICY "deletion_requests_insert" ON data_deletion_requests
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "deletion_requests_read" ON data_deletion_requests
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  );
CREATE POLICY "deletion_requests_update" ON data_deletion_requests
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  );

-- Consent logs: admin/manager read; insert by anyone authenticated
CREATE POLICY "consent_logs_insert" ON consent_logs
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "consent_logs_read" ON consent_logs
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  );
