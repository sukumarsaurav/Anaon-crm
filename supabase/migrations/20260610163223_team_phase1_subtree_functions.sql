-- All teams in the subtree rooted at `root` (the team + descendants).
CREATE OR REPLACE FUNCTION get_team_subtree(root uuid)
RETURNS setof uuid
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH RECURSIVE sub AS (
    SELECT id FROM teams WHERE id = root AND is_active
    UNION
    SELECT t.id FROM teams t JOIN sub ON t.parent_team_id = sub.id WHERE t.is_active
  )
  SELECT id FROM sub;
$$;

-- Profile ids the current user may see: admin → everyone; a leader → all
-- members in the subtree of any team they lead; everyone → at least themselves.
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
    RETURN QUERY SELECT id FROM profiles WHERE is_active;
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