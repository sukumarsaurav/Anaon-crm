-- SECURITY INVOKER: counts run through the caller's leads RLS, so the stats
-- automatically reflect the team-hierarchy visibility. Params kept for the
-- existing call signature but ignored.
CREATE OR REPLACE FUNCTION get_lead_stats(p_user_id uuid, p_role text, p_branch_id uuid)
RETURNS json
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT json_build_object(
    'total',          count(*),
    'hot',            count(*) FILTER (WHERE score >= 80),
    'overdue',        count(*) FILTER (WHERE next_followup_at < now()
                          AND stage NOT IN ('closed_won','not_interested')),
    'todayFollowups', count(*) FILTER (WHERE (next_followup_at AT TIME ZONE 'Asia/Kolkata')::date
                          = (now() AT TIME ZONE 'Asia/Kolkata')::date),
    'newToday',       count(*) FILTER (WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date
                          = (now() AT TIME ZONE 'Asia/Kolkata')::date)
  )
  FROM leads
  WHERE is_active;
$$;