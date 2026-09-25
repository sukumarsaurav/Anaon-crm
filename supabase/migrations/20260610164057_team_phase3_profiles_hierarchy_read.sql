-- Admin should see all profiles (incl. inactive) for admin screens.
CREATE OR REPLACE FUNCTION current_user_visible_members()
RETURNS setof uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); urole user_role;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  SELECT role INTO urole FROM profiles WHERE id = uid;
  IF urole = 'admin' THEN
    RETURN QUERY SELECT id FROM profiles;
    RETURN;
  END IF;
  RETURN QUERY
    SELECT DISTINCT m.id
    FROM profiles m
    WHERE m.team_id IN (
      SELECT st.tid
      FROM teams led
      CROSS JOIN LATERAL get_team_subtree(led.id) AS st(tid)
      WHERE led.leader_id = uid AND led.is_active
    )
    UNION
    SELECT uid;
END $$;

-- Read profiles within your hierarchy (self + downline; admin → all).
-- SECURITY DEFINER function (owned by a BYPASSRLS role) avoids policy recursion.
DROP POLICY IF EXISTS profiles_read_hierarchy ON profiles;
CREATE POLICY profiles_read_hierarchy ON profiles
  FOR SELECT TO authenticated
  USING (id IN (SELECT current_user_visible_members()));