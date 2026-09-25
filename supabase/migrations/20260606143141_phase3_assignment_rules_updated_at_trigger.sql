DROP TRIGGER IF EXISTS assignment_rules_set_updated_at ON assignment_rules;
CREATE TRIGGER assignment_rules_set_updated_at
  BEFORE UPDATE ON assignment_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();