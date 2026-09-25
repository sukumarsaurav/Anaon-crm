CREATE TABLE IF NOT EXISTS assignment_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  priority integer NOT NULL DEFAULT 100,        -- lower runs first
  is_active boolean NOT NULL DEFAULT true,
  -- Conditions (NULL / empty array = "any")
  match_sources lead_source[],
  match_property_types text[],
  match_cities text[],                           -- matched case-insensitively vs lead.city
  budget_min numeric,                            -- rule lower bound (lakhs/rupees, same unit as leads)
  budget_max numeric,                            -- rule upper bound
  -- Target
  assign_mode text NOT NULL DEFAULT 'round_robin' CHECK (assign_mode IN ('specific','round_robin')),
  assign_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assign_pool uuid[],                            -- round_robin pool; NULL = all active advisors
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignment_rules_active_priority
  ON assignment_rules (priority) WHERE is_active = true;

ALTER TABLE assignment_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY assignment_rules_read_authenticated ON assignment_rules
  FOR SELECT USING (true);
CREATE POLICY assignment_rules_write_authenticated ON assignment_rules
  FOR ALL USING (true) WITH CHECK (true);

-- Keep updated_at fresh (reuse existing trigger fn if present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE TRIGGER assignment_rules_set_updated_at
      BEFORE UPDATE ON assignment_rules
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;