
-- Branches (multi-city support)
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE,
  email TEXT,
  role user_role NOT NULL DEFAULT 'sales_advisor',
  branch_id UUID REFERENCES branches(id),
  designation TEXT,
  photo_url TEXT,
  date_of_birth DATE,
  joining_date DATE,
  monthly_target_revenue NUMERIC(15,2) DEFAULT 0,
  monthly_target_bookings INTEGER DEFAULT 0,
  monthly_target_site_visits INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Branches: everyone can read
CREATE POLICY "branches_read_all" ON branches FOR SELECT USING (true);

-- Profiles: users see own; managers see their branch; admins see all
CREATE POLICY "profiles_read_own" ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (id = auth.uid());
