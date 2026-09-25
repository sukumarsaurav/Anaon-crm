
-- KYC checklist booleans on clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS kyc_aadhar_submitted    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS kyc_pan_submitted        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS kyc_photo_submitted      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS kyc_address_proof_submitted boolean DEFAULT false;

-- Human-readable label on client documents
ALTER TABLE client_documents
  ADD COLUMN IF NOT EXISTS name text;

-- Priority on complaints
ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

-- Generic payment reference (covers UPI ref, online txn, etc.)
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_reference text;

-- RLS policies for clients (team members can read all clients)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clients' AND policyname = 'team_read_clients') THEN
    CREATE POLICY team_read_clients ON clients FOR SELECT
      USING (auth.uid() IN (SELECT id FROM profiles WHERE is_active = true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clients' AND policyname = 'team_write_clients') THEN
    CREATE POLICY team_write_clients ON clients FOR ALL
      USING (auth.uid() IN (SELECT id FROM profiles WHERE is_active = true));
  END IF;
END $$;

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'team_read_bookings') THEN
    CREATE POLICY team_read_bookings ON bookings FOR SELECT
      USING (auth.uid() IN (SELECT id FROM profiles WHERE is_active = true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'team_write_bookings') THEN
    CREATE POLICY team_write_bookings ON bookings FOR ALL
      USING (auth.uid() IN (SELECT id FROM profiles WHERE is_active = true));
  END IF;
END $$;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'team_read_payments') THEN
    CREATE POLICY team_read_payments ON payments FOR SELECT
      USING (auth.uid() IN (SELECT id FROM profiles WHERE is_active = true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'team_write_payments') THEN
    CREATE POLICY team_write_payments ON payments FOR ALL
      USING (auth.uid() IN (SELECT id FROM profiles WHERE is_active = true));
  END IF;
END $$;

ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_documents' AND policyname = 'team_read_client_docs') THEN
    CREATE POLICY team_read_client_docs ON client_documents FOR SELECT
      USING (auth.uid() IN (SELECT id FROM profiles WHERE is_active = true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_documents' AND policyname = 'team_write_client_docs') THEN
    CREATE POLICY team_write_client_docs ON client_documents FOR ALL
      USING (auth.uid() IN (SELECT id FROM profiles WHERE is_active = true));
  END IF;
END $$;

ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'complaints' AND policyname = 'team_read_complaints') THEN
    CREATE POLICY team_read_complaints ON complaints FOR SELECT
      USING (auth.uid() IN (SELECT id FROM profiles WHERE is_active = true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'complaints' AND policyname = 'team_write_complaints') THEN
    CREATE POLICY team_write_complaints ON complaints FOR ALL
      USING (auth.uid() IN (SELECT id FROM profiles WHERE is_active = true));
  END IF;
END $$;
