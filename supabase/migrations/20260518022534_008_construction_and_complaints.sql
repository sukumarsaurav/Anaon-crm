
-- Construction milestones per project
CREATE TABLE construction_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  payment_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,  -- % of total sale value triggered on completion
  sequence_order INTEGER NOT NULL,
  expected_date DATE,
  actual_completion_date DATE,
  completion_percentage NUMERIC(5,2) DEFAULT 0,  -- partial completion tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed')),
  photos JSONB DEFAULT '[]',
  notes TEXT,
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Complaints & after-sales support
CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number TEXT UNIQUE NOT NULL DEFAULT 'TKT-' || LPAD(FLOOR(RANDOM()*999999)::TEXT, 6, '0'),
  client_id UUID NOT NULL REFERENCES clients(id),
  booking_id UUID REFERENCES bookings(id),
  category TEXT NOT NULL CHECK (category IN (
    'payment_dispute', 'document_issue', 'construction_delay',
    'quality_issue', 'billing_error', 'other'
  )),
  description TEXT NOT NULL,
  photo_urls JSONB DEFAULT '[]',
  status complaint_status DEFAULT 'open',
  assigned_to UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE construction_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milestones_read_authenticated" ON construction_milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "milestones_write_authenticated" ON construction_milestones FOR ALL TO authenticated USING (true);
CREATE POLICY "complaints_read_authenticated" ON complaints FOR SELECT TO authenticated USING (true);
CREATE POLICY "complaints_write_authenticated" ON complaints FOR ALL TO authenticated USING (true);
