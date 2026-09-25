
-- Leads
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Basic info
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  alternate_phone TEXT,
  email TEXT,
  city TEXT,
  locality TEXT,
  -- Interest
  project_id UUID REFERENCES projects(id),
  property_type project_type,
  budget_min NUMERIC(15,2),
  budget_max NUMERIC(15,2),
  configuration TEXT,
  purpose TEXT CHECK (purpose IN ('investment', 'self_use', 'rental')),
  timeline TEXT CHECK (timeline IN ('immediate', '3_months', '6_months', '1_year_plus')),
  -- Source & UTM
  source lead_source NOT NULL DEFAULT 'manual',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  campaign_name TEXT,
  ad_set_name TEXT,
  keyword TEXT,
  landing_page_url TEXT,
  device_type TEXT CHECK (device_type IN ('mobile', 'desktop', 'tablet')),
  -- Assignment & scoring
  assigned_to UUID REFERENCES profiles(id),
  branch_id UUID REFERENCES branches(id),
  stage lead_stage NOT NULL DEFAULT 'new_lead',
  temperature lead_temperature DEFAULT 'cold',
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  -- Follow-up
  next_followup_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  preferred_contact_time TEXT,
  preferred_contact_method TEXT CHECK (preferred_contact_method IN ('call', 'whatsapp', 'email')),
  follow_up_count INTEGER DEFAULT 0,
  -- Referral
  referred_by_client_id UUID,
  broker_id UUID,
  -- Meta
  whatsapp_opt_in BOOLEAN DEFAULT true,
  is_duplicate BOOLEAN DEFAULT false,
  duplicate_of UUID REFERENCES leads(id),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead activities / timeline
CREATE TABLE lead_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'call', 'whatsapp', 'email', 'sms', 'note',
    'stage_change', 'assignment', 'site_visit', 'document_shared', 'system'
  )),
  outcome follow_up_outcome,
  notes TEXT,
  stage_from lead_stage,
  stage_to lead_stage,
  call_duration_seconds INTEGER,
  scheduled_at TIMESTAMPTZ,
  performed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Site visits
CREATE TABLE site_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  visited_at TIMESTAMPTZ,
  accompanied_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  client_feedback TEXT,
  advisor_notes TEXT,
  gps_checkin_lat NUMERIC(10,7),
  gps_checkin_lng NUMERIC(10,7),
  photos JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

-- Leads: advisors see own assigned; managers/admins see all (handled via app-level helper)
CREATE POLICY "leads_read_assigned" ON leads FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid());

CREATE POLICY "leads_insert_authenticated" ON leads FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "leads_update_assigned" ON leads FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid());

CREATE POLICY "lead_activities_read_authenticated" ON lead_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "lead_activities_insert_authenticated" ON lead_activities FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "site_visits_read_authenticated" ON site_visits FOR SELECT TO authenticated USING (true);
CREATE POLICY "site_visits_insert_authenticated" ON site_visits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "site_visits_update_authenticated" ON site_visits FOR UPDATE TO authenticated USING (true);
