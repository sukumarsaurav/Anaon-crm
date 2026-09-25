
-- Brokers / Channel partners
CREATE TABLE brokers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  firm_name TEXT,
  rera_number TEXT,
  city TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  bank_account_number TEXT,
  bank_ifsc TEXT,
  bank_name TEXT,
  commission_rate NUMERIC(5,2) DEFAULT 2.0,  -- percentage
  portal_user_id UUID,  -- maps to auth.users for broker portal login
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'inactive')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK from bookings to brokers
ALTER TABLE bookings ADD CONSTRAINT bookings_broker_fk
  FOREIGN KEY (broker_id) REFERENCES brokers(id);

-- Add FK from leads to brokers
ALTER TABLE leads ADD CONSTRAINT leads_broker_fk
  FOREIGN KEY (broker_id) REFERENCES brokers(id);

-- Broker commissions
CREATE TABLE broker_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broker_id UUID NOT NULL REFERENCES brokers(id),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  booking_value NUMERIC(15,2) NOT NULL,
  commission_pct NUMERIC(5,2) NOT NULL,
  commission_amount NUMERIC(15,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'disputed')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  utr_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brokers_read_authenticated" ON brokers FOR SELECT TO authenticated USING (true);
CREATE POLICY "brokers_insert_authenticated" ON brokers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "brokers_update_authenticated" ON brokers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "broker_commissions_read_authenticated" ON broker_commissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "broker_commissions_insert_authenticated" ON broker_commissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "broker_commissions_update_authenticated" ON broker_commissions FOR UPDATE TO authenticated USING (true);
