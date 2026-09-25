
-- Extend career_applications with recruitment pipeline fields
ALTER TABLE career_applications
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'applied'
    CHECK (stage IN ('applied','shortlisted','interview_scheduled','interview_done','offer','joined','rejected')),
  ADD COLUMN IF NOT EXISTS current_company text,
  ADD COLUMN IF NOT EXISTS current_ctc numeric(12,2),
  ADD COLUMN IF NOT EXISTS expected_ctc numeric(12,2),
  ADD COLUMN IF NOT EXISTS experience_years numeric(4,1),
  ADD COLUMN IF NOT EXISTS interview_date timestamptz,
  ADD COLUMN IF NOT EXISTS interviewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS interview_mode text CHECK (interview_mode IN ('in_person','video','phone')),
  ADD COLUMN IF NOT EXISTS interview_rating integer CHECK (interview_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS interview_feedback text,
  ADD COLUMN IF NOT EXISTS offer_ctc numeric(12,2),
  ADD COLUMN IF NOT EXISTS offer_date date,
  ADD COLUMN IF NOT EXISTS joining_date date,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Extend profiles with HR-specific fields
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS reporting_manager_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS probation_end_date date,
  ADD COLUMN IF NOT EXISTS employment_type text DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time','part_time','contract','intern')),
  ADD COLUMN IF NOT EXISTS aadhar_number text,
  ADD COLUMN IF NOT EXISTS pan_number text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_ifsc text,
  ADD COLUMN IF NOT EXISTS termination_date date,
  ADD COLUMN IF NOT EXISTS termination_reason text;

-- Leave balances per employee per year
CREATE TABLE hr_leave_balances (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year        integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  leave_type  text NOT NULL CHECK (leave_type IN ('casual','sick','earned','maternity','paternity','unpaid')),
  entitled    integer NOT NULL DEFAULT 0,
  used        integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, year, leave_type)
);

-- Payroll runs (one per month)
CREATE TABLE payroll_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year             integer NOT NULL,
  month            integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','processing','completed','cancelled')),
  total_gross      numeric(14,2) DEFAULT 0,
  total_deductions numeric(14,2) DEFAULT 0,
  total_net        numeric(14,2) DEFAULT 0,
  total_employees  integer DEFAULT 0,
  notes            text,
  processed_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  processed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(year, month)
);

-- Per-employee payslip per run
CREATE TABLE payroll_slips (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  working_days      integer NOT NULL DEFAULT 0,
  present_days      integer NOT NULL DEFAULT 0,
  lop_days          integer NOT NULL DEFAULT 0,
  basic             numeric(12,2) DEFAULT 0,
  hra               numeric(12,2) DEFAULT 0,
  allowances        numeric(12,2) DEFAULT 0,
  incentives        numeric(12,2) DEFAULT 0,
  gross             numeric(12,2) DEFAULT 0,
  pf_employee       numeric(12,2) DEFAULT 0,
  pf_employer       numeric(12,2) DEFAULT 0,
  professional_tax  numeric(12,2) DEFAULT 0,
  tds               numeric(12,2) DEFAULT 0,
  total_deductions  numeric(12,2) DEFAULT 0,
  net_pay           numeric(12,2) DEFAULT 0,
  slip_url          text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id, user_id)
);

-- RLS
ALTER TABLE hr_leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_slips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read hr_leave_balances"
  ON hr_leave_balances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage hr_leave_balances"
  ON hr_leave_balances FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read payroll_runs"
  ON payroll_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage payroll_runs"
  ON payroll_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read payroll_slips"
  ON payroll_slips FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage payroll_slips"
  ON payroll_slips FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_career_applications_stage ON career_applications(stage);
CREATE INDEX idx_career_applications_listing_id ON career_applications(listing_id);
CREATE INDEX idx_hr_leave_balances_user_year ON hr_leave_balances(user_id, year);
CREATE INDEX idx_payroll_runs_year_month ON payroll_runs(year, month);
CREATE INDEX idx_payroll_slips_run_id ON payroll_slips(run_id);
CREATE INDEX idx_payroll_slips_user_id ON payroll_slips(user_id);
