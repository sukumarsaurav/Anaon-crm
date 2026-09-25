
-- ── Bank / NBFC tie-ups ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_tieups (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name           TEXT NOT NULL,
  loan_product_name   TEXT NOT NULL,
  applicable_projects UUID[],              -- NULL = all projects
  max_loan_pct        NUMERIC(5,2),        -- e.g. 75.00 (%)
  interest_rate       NUMERIC(5,2),        -- annual %
  interest_type       TEXT DEFAULT 'floating' CHECK (interest_type IN ('floating','fixed')),
  processing_fee      NUMERIC(12,2),       -- absolute amount in ₹
  processing_fee_pct  NUMERIC(5,2),        -- or as % of loan
  rm_name             TEXT,
  rm_phone            TEXT,
  rm_email            TEXT,
  turnaround_days     INTEGER,             -- typical sanction TAT
  notes               TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── DSA (Direct Selling Agent) profiles ───────────────────────────────────
CREATE TABLE IF NOT EXISTS dsas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  firm_name           TEXT,
  bank_empanelments   TEXT[],              -- list of banks they work with
  contact_phone       TEXT,
  contact_email       TEXT,
  city                TEXT,
  commission_rate     NUMERIC(5,2),        -- % of loan amount
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  notes               TEXT,
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Loan applications (client loan journey) ───────────────────────────────
CREATE TABLE IF NOT EXISTS loan_applications (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  booking_id              UUID REFERENCES bookings(id) ON DELETE SET NULL,
  bank_tieup_id           UUID REFERENCES bank_tieups(id) ON DELETE SET NULL,
  dsa_id                  UUID REFERENCES dsas(id) ON DELETE SET NULL,

  -- Stage tracking
  stage                   TEXT NOT NULL DEFAULT 'eligibility_check'
                          CHECK (stage IN (
                            'eligibility_check','bank_selected','application_submitted',
                            'docs_submitted','sanction_received','disbursement','rejected'
                          )),

  -- Eligibility info
  monthly_income          NUMERIC(14,2),
  existing_emis           NUMERIC(14,2),
  credit_score            INTEGER,         -- CIBIL / Experian score

  -- Application
  rm_contacted_date       DATE,
  loan_amount_applied     NUMERIC(14,2),
  application_date        DATE,
  processing_fee_paid     NUMERIC(12,2),
  processing_fee_date     DATE,

  -- Document checklist
  doc_income_proof        BOOLEAN DEFAULT FALSE,
  doc_kyc                 BOOLEAN DEFAULT FALSE,
  doc_property_docs       BOOLEAN DEFAULT FALSE,
  doc_noc                 BOOLEAN DEFAULT FALSE,
  doc_bank_statement      BOOLEAN DEFAULT FALSE,
  doc_itr                 BOOLEAN DEFAULT FALSE,

  -- Sanction
  sanctioned_amount       NUMERIC(14,2),
  sanctioned_interest_rate NUMERIC(5,2),
  sanctioned_tenure_months INTEGER,
  sanction_date           DATE,

  -- Rejection
  rejection_date          DATE,
  rejection_reason        TEXT,
  alternate_bank_tried    TEXT,

  notes                   TEXT,
  created_by              UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Loan disbursements (milestone-linked tranches) ─────────────────────────
CREATE TABLE IF NOT EXISTS loan_disbursements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  milestone_id        UUID REFERENCES construction_milestones(id) ON DELETE SET NULL,
  tranche_number      INTEGER NOT NULL DEFAULT 1,
  expected_amount     NUMERIC(14,2) NOT NULL,
  actual_amount       NUMERIC(14,2),
  expected_date       DATE,
  actual_date         DATE,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','received','delayed')),
  bank_reference      TEXT,               -- UTR / reference from bank
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_loan_apps_client ON loan_applications (client_id);
CREATE INDEX IF NOT EXISTS idx_loan_apps_stage  ON loan_applications (stage);
CREATE INDEX IF NOT EXISTS idx_loan_apps_booking ON loan_applications (booking_id);
CREATE INDEX IF NOT EXISTS idx_loan_disb_app    ON loan_disbursements (loan_application_id, status);
CREATE INDEX IF NOT EXISTS idx_loan_disb_milestone ON loan_disbursements (milestone_id);

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE bank_tieups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_applications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_disbursements  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_tieups_read"  ON bank_tieups FOR SELECT TO authenticated USING (true);
CREATE POLICY "bank_tieups_write" ON bank_tieups FOR ALL    TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
);

CREATE POLICY "dsas_read"  ON dsas FOR SELECT TO authenticated USING (true);
CREATE POLICY "dsas_write" ON dsas FOR ALL    TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
);

CREATE POLICY "loan_apps_read"  ON loan_applications FOR SELECT TO authenticated USING (true);
CREATE POLICY "loan_apps_write" ON loan_applications FOR ALL    TO authenticated USING (true);

CREATE POLICY "loan_disb_read"  ON loan_disbursements FOR SELECT TO authenticated USING (true);
CREATE POLICY "loan_disb_write" ON loan_disbursements FOR ALL    TO authenticated USING (true);
