
-- Extend bookings with approval + document fields
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS approved_by              uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at              timestamptz,
  ADD COLUMN IF NOT EXISTS approval_notes           text,
  ADD COLUMN IF NOT EXISTS allotment_letter_url     text,
  ADD COLUMN IF NOT EXISTS allotment_letter_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS agreement_url            text,
  ADD COLUMN IF NOT EXISTS agreement_signed         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_form_url         text,
  ADD COLUMN IF NOT EXISTS referred_by_source       text,   -- 'broker'|'client'|'campaign'|'walk_in'
  ADD COLUMN IF NOT EXISTS payment_plan_type        text DEFAULT 'custom';
                                                            -- down_payment|construction_linked|subvention|custom

-- RLS on broker_commissions
ALTER TABLE broker_commissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'broker_commissions' AND policyname = 'team_read_commissions') THEN
    CREATE POLICY team_read_commissions ON broker_commissions FOR SELECT
      USING (auth.uid() IN (SELECT id FROM profiles WHERE is_active = true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'broker_commissions' AND policyname = 'team_write_commissions') THEN
    CREATE POLICY team_write_commissions ON broker_commissions FOR ALL
      USING (auth.uid() IN (SELECT id FROM profiles WHERE is_active = true));
  END IF;
END $$;

-- RLS on brokers
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'brokers' AND policyname = 'team_read_brokers') THEN
    CREATE POLICY team_read_brokers ON brokers FOR SELECT
      USING (auth.uid() IN (SELECT id FROM profiles WHERE is_active = true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'brokers' AND policyname = 'team_write_brokers') THEN
    CREATE POLICY team_write_brokers ON brokers FOR ALL
      USING (auth.uid() IN (SELECT id FROM profiles WHERE is_active = true));
  END IF;
END $$;

-- Function: auto-generate payment schedule from booking
-- Called after booking confirmed; creates installments based on payment_plan_type
-- (schedule is built explicitly by the advisor, this is the trigger to stamp booking_id on existing payments)

-- Index for fast pending-approval queries
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_advisor ON bookings(advisor_id);
CREATE INDEX IF NOT EXISTS idx_bookings_project ON bookings(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking  ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON payments(due_date);
