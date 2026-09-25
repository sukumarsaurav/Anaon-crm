
-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type project_type NOT NULL,
  city TEXT NOT NULL,
  locality TEXT,
  address TEXT,
  google_maps_pin TEXT,
  rera_number TEXT,
  rera_registration_date DATE,
  rera_expiry_date DATE,
  status project_status NOT NULL DEFAULT 'pre_launch',
  launch_date DATE,
  expected_completion_date DATE,
  description TEXT,
  total_units INTEGER,
  branch_id UUID REFERENCES branches(id),
  project_manager_id UUID REFERENCES profiles(id),
  brochure_url TEXT,
  price_list_url TEXT,
  video_url TEXT,
  virtual_tour_url TEXT,
  layout_image_url TEXT,
  amenities JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plots / Units
CREATE TABLE plots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  plot_number TEXT NOT NULL,
  size_sqyd NUMERIC(10,2),
  size_sqft NUMERIC(10,2),
  type plot_type DEFAULT 'regular',
  facing facing_direction,
  floor_number INTEGER,
  configuration TEXT, -- e.g. "2BHK", "3BHK", "Plot"
  base_price NUMERIC(15,2) NOT NULL,
  corner_premium NUMERIC(5,2) DEFAULT 0,   -- percentage
  facing_premium NUMERIC(5,2) DEFAULT 0,
  other_premium NUMERIC(15,2) DEFAULT 0,    -- fixed amount
  development_charges NUMERIC(15,2) DEFAULT 0,
  total_price NUMERIC(15,2) GENERATED ALWAYS AS (
    base_price * (1 + corner_premium/100 + facing_premium/100) + other_premium + development_charges
  ) STORED,
  status plot_status NOT NULL DEFAULT 'available',
  held_by UUID REFERENCES profiles(id),
  held_until TIMESTAMPTZ,
  booked_by_client_id UUID, -- FK added after clients table
  booking_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, plot_number)
);

-- Price escalation schedule
CREATE TABLE price_escalations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  escalation_date DATE NOT NULL,
  percentage_increase NUMERIC(5,2) NOT NULL,
  notes TEXT,
  applied BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_escalations ENABLE ROW LEVEL SECURITY;

-- Projects readable by authenticated users
CREATE POLICY "projects_read_authenticated" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "plots_read_authenticated" ON plots FOR SELECT TO authenticated USING (true);
CREATE POLICY "price_escalations_read_authenticated" ON price_escalations FOR SELECT TO authenticated USING (true);
