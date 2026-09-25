-- Associated developers (logo grid on the website)
CREATE TABLE IF NOT EXISTS developers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  logo_url text,
  website_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Public-facing advisory team ("Meet the Team")
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  designation text,
  level text,                       -- Director / Corporate Director / Associate Director / Advisor
  photo_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Website-facing fields on projects (reuse existing gallery/amenities/rera/brochure)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS developer_id uuid REFERENCES developers(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS starting_price numeric;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS price_per_sqft numeric;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS bhk_config text;          -- e.g. "2,3,4 BHK"
ALTER TABLE projects ADD COLUMN IF NOT EXISTS website_category text;    -- residential / luxury / commercial
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS hero_image_url text;

ALTER TABLE developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Public read (anon), authenticated write
CREATE POLICY developers_public_read ON developers FOR SELECT USING (true);
CREATE POLICY developers_write_auth ON developers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY team_members_public_read ON team_members FOR SELECT USING (true);
CREATE POLICY team_members_write_auth ON team_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_developers_active ON developers(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_team_members_public ON team_members(is_public, sort_order);
CREATE INDEX IF NOT EXISTS idx_projects_featured ON projects(is_featured) WHERE is_active = true;