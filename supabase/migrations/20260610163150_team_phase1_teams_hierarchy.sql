-- Named teams that nest into a chain via parent_team_id
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  leader_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  parent_team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Which team a member belongs to
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teams_parent ON teams(parent_team_id);
CREATE INDEX IF NOT EXISTS idx_teams_leader ON teams(leader_id);
CREATE INDEX IF NOT EXISTS idx_profiles_team ON profiles(team_id);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY teams_read_authenticated ON teams FOR SELECT TO authenticated USING (true);
CREATE POLICY teams_write_authenticated ON teams FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- updated_at trigger (project uses update_updated_at)
DROP TRIGGER IF EXISTS teams_set_updated_at ON teams;
CREATE TRIGGER teams_set_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Cycle guard: a team cannot become its own ancestor
CREATE OR REPLACE FUNCTION teams_prevent_cycle() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE p uuid;
BEGIN
  IF NEW.parent_team_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.parent_team_id = NEW.id THEN
    RAISE EXCEPTION 'A team cannot be its own parent';
  END IF;
  p := NEW.parent_team_id;
  WHILE p IS NOT NULL LOOP
    IF p = NEW.id THEN RAISE EXCEPTION 'Cycle detected in team hierarchy'; END IF;
    SELECT parent_team_id INTO p FROM teams WHERE id = p;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS teams_cycle_guard ON teams;
CREATE TRIGGER teams_cycle_guard BEFORE INSERT OR UPDATE OF parent_team_id ON teams
  FOR EACH ROW EXECUTE FUNCTION teams_prevent_cycle();