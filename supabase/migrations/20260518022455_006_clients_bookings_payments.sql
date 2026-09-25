
-- Clients (post-booking)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id),
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  pan_encrypted TEXT,   -- encrypted at app level
  aadhar_encrypted TEXT,
  phone TEXT NOT NULL,
  alternate_phone TEXT,
  email TEXT,
  permanent_address TEXT,
  communication_address TEXT,
  photo_url TEXT,
  occupation_type TEXT CHECK (occupation_type IN ('salaried', 'self_employed', 'business', 'other')),
  company_name TEXT,
  monthly_income NUMERIC(15,2),
  annual_income NUMERIC(15,2),
  kyc_status kyc_status DEFAULT 'pending',
  -- Co-applicant
  co_applicant_name TEXT,
  co_applicant_relationship TEXT,
  co_applicant_phone TEXT,
  co_applicant_pan_encrypted TEXT,
  co_applicant_aadhar_encrypted TEXT,
  -- Nominee
  nominee_name TEXT,
  nominee_relationship TEXT,
  nominee_dob DATE,
  nominee_phone TEXT,
  -- Auth portal
  portal_user_id UUID,  -- maps to auth.users for client portal login
  whatsapp_opt_in BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK from plots to clients (deferred)
ALTER TABLE plots ADD CONSTRAINT plots_booked_by_client_fk
  FOREIGN KEY (booked_by_client_id) REFERENCES clients(id);

-- Bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_number TEXT UNIQUE NOT NULL DEFAULT 'BK-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(FLOOR(RANDOM()*99999)::TEXT, 5, '0'),
  client_id UUID NOT NULL REFERENCES clients(id),
  plot_id UUID NOT NULL REFERENCES plots(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  total_sale_value NUMERIC(15,2) NOT NULL,
  booking_amount NUMERIC(15,2) NOT NULL,
  payment_plan TEXT CHECK (payment_plan IN ('down_payment', 'construction_linked', 'subvention', 'custom')),
  advisor_id UUID REFERENCES profiles(id),
  manager_id UUID REFERENCES profiles(id),
  broker_id UUID, -- FK added after brokers table
  broker_commission_pct NUMERIC(5,2),
  broker_commission_amount NUMERIC(15,2),
  booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  agreement_date DATE,
  expected_possession_date DATE,
  status booking_status DEFAULT 'pending_approval',
  cancellation_reason TEXT,
  cancellation_date DATE,
  cancellation_charges NUMERIC(15,2),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment schedule
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES clients(id),
  installment_number INTEGER NOT NULL,
  description TEXT,   -- e.g. "Booking amount", "On possession"
  amount_due NUMERIC(15,2) NOT NULL,
  due_date DATE NOT NULL,
  amount_paid NUMERIC(15,2) DEFAULT 0,
  paid_date DATE,
  mode payment_mode,
  transaction_id TEXT,
  cheque_number TEXT,
  bank_name TEXT,
  status payment_status DEFAULT 'pending',
  late_charge NUMERIC(15,2) DEFAULT 0,
  receipt_url TEXT,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client documents
CREATE TABLE client_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id),
  document_type TEXT NOT NULL,  -- 'aadhar', 'pan', 'booking_form', 'agreement', etc.
  file_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'verified', 'rejected')),
  uploaded_by UUID REFERENCES profiles(id),
  verified_by UUID REFERENCES profiles(id),
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_read_authenticated" ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_insert_authenticated" ON clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "clients_update_authenticated" ON clients FOR UPDATE TO authenticated USING (true);

CREATE POLICY "bookings_read_authenticated" ON bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "bookings_insert_authenticated" ON bookings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "bookings_update_authenticated" ON bookings FOR UPDATE TO authenticated USING (true);

CREATE POLICY "payments_read_authenticated" ON payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "payments_insert_authenticated" ON payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "payments_update_authenticated" ON payments FOR UPDATE TO authenticated USING (true);

CREATE POLICY "client_documents_read_authenticated" ON client_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "client_documents_insert_authenticated" ON client_documents FOR INSERT TO authenticated WITH CHECK (true);
