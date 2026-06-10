-- ==============================================================================
-- 🚀 ANON INDIA CRM — Performance RPC Migrations
-- Please run these functions in your Supabase SQL Editor.
-- ==============================================================================

-- 1. get_lead_stats
CREATE OR REPLACE FUNCTION get_lead_stats(
  p_user_id UUID,
  p_role TEXT,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'total',          COUNT(*),
    'hot',            COUNT(*) FILTER (WHERE score >= 80),
    'overdue',        COUNT(*) FILTER (WHERE next_followup_at < NOW() AND next_followup_at IS NOT NULL),
    'todayFollowups', COUNT(*) FILTER (WHERE next_followup_at::date = CURRENT_DATE),
    'newToday',       COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)
  )
  FROM leads
  WHERE is_active = TRUE
    AND (
      CASE
        WHEN p_role IN ('admin', 'manager') AND p_branch_id IS NOT NULL THEN branch_id = p_branch_id
        WHEN p_role IN ('sales_advisor', 'telecaller') THEN assigned_to = p_user_id
        ELSE TRUE
      END
    );
$$;

-- 2. get_booking_stats
CREATE OR REPLACE FUNCTION get_booking_stats()
RETURNS JSON
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'total',            COUNT(*),
    'pending_approval', COUNT(*) FILTER (WHERE status = 'pending_approval'),
    'confirmed',        COUNT(*) FILTER (WHERE status = 'confirmed'),
    'cancelled',        COUNT(*) FILTER (WHERE status = 'cancelled'),
    'total_value',      COALESCE(SUM(total_sale_value) FILTER (WHERE status = 'confirmed'), 0),
    'total_collected',  0
  )
  FROM bookings;
$$;

-- 3. get_exec_dashboard
CREATE OR REPLACE FUNCTION get_exec_dashboard()
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  curr_start DATE := date_trunc('month', CURRENT_DATE);
  curr_end DATE := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date;
  prev_start DATE := (date_trunc('month', CURRENT_DATE) - interval '1 month')::date;
  prev_end DATE := (curr_start - interval '1 day')::date;
  result JSON;
BEGIN
  SELECT json_build_object(
    'currLeads', (SELECT COUNT(*) FROM leads WHERE is_active AND created_at::date BETWEEN curr_start AND curr_end),
    'prevLeads', (SELECT COUNT(*) FROM leads WHERE is_active AND created_at::date BETWEEN prev_start AND prev_end),
    'currVisits', (SELECT COUNT(*) FROM site_visits WHERE created_at::date BETWEEN curr_start AND curr_end),
    'prevVisits', (SELECT COUNT(*) FROM site_visits WHERE created_at::date BETWEEN prev_start AND prev_end),
    'currBookings', (SELECT COUNT(*) FROM bookings WHERE status = 'confirmed' AND booking_date BETWEEN curr_start AND curr_end),
    'prevBookings', (SELECT COUNT(*) FROM bookings WHERE status = 'confirmed' AND booking_date BETWEEN prev_start AND prev_end),
    'currRevenue', COALESCE((SELECT SUM(total_sale_value) FROM bookings WHERE status = 'confirmed' AND booking_date BETWEEN curr_start AND curr_end), 0),
    'prevRevenue', COALESCE((SELECT SUM(total_sale_value) FROM bookings WHERE status = 'confirmed' AND booking_date BETWEEN prev_start AND prev_end), 0),
    'currCollections', COALESCE((SELECT SUM(amount_paid) FROM payments WHERE status = 'paid' AND paid_date BETWEEN curr_start AND curr_end), 0),
    'outstanding', COALESCE((SELECT SUM(amount_due) FROM payments WHERE status IN ('pending', 'overdue')), 0)
  ) INTO result;

  RETURN result;
END;
$$;

-- 4. get_loan_stats
CREATE OR REPLACE FUNCTION get_loan_stats()
RETURNS JSON
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'totalApplications', (SELECT COUNT(*) FROM loan_applications),
    'activeApplications', (SELECT COUNT(*) FROM loan_applications WHERE stage IN ('eligibility_check','bank_selected','application_submitted','docs_submitted','sanction_received','disbursement')),
    'rejected', (SELECT COUNT(*) FROM loan_applications WHERE stage = 'rejected'),
    'totalSanctioned', COALESCE((SELECT SUM(sanctioned_amount) FROM loan_applications), 0),
    'totalDisbursed', COALESCE((SELECT SUM(actual_amount) FROM loan_disbursements WHERE status = 'received'), 0),
    'pendingDisbursements', (SELECT COUNT(*) FROM loan_disbursements WHERE status = 'pending'),
    'delayedDisbursements', (SELECT COUNT(*) FROM loan_disbursements WHERE status = 'delayed'),
    'byStage', (
      SELECT json_object_agg(stage, count)
      FROM (SELECT stage, COUNT(*) as count FROM loan_applications GROUP BY stage) s
    )
  );
$$;

-- 5. get_advisor_scorecard
CREATE OR REPLACE FUNCTION get_advisor_scorecard(p_from DATE DEFAULT NULL, p_to DATE DEFAULT NULL)
RETURNS JSON
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(json_agg(row_to_json(res)), '[]'::json)
  FROM (
    SELECT 
      p.id,
      p.full_name as name,
      p.designation,
      COALESCE(p.monthly_target_bookings, 0) as "targetBookings",
      COALESCE(p.monthly_target_revenue, 0) as "targetRevenue",
      (SELECT COUNT(*) FROM leads l WHERE l.assigned_to = p.id AND l.is_active = TRUE) as leads,
      (SELECT COUNT(*) FROM lead_activities a WHERE a.performed_by = p.id AND a.type = 'call' AND (p_from IS NULL OR a.created_at::date >= p_from) AND (p_to IS NULL OR a.created_at::date <= p_to)) as calls,
      (SELECT COUNT(*) FROM lead_activities a WHERE a.performed_by = p.id AND a.type = 'follow_up' AND (p_from IS NULL OR a.created_at::date >= p_from) AND (p_to IS NULL OR a.created_at::date <= p_to)) as "followUps",
      (SELECT COUNT(*) FROM site_visits v WHERE v.accompanied_by = p.id AND (p_from IS NULL OR v.created_at::date >= p_from) AND (p_to IS NULL OR v.created_at::date <= p_to)) as visits,
      (SELECT COUNT(*) FROM bookings b WHERE b.advisor_id = p.id AND b.status = 'confirmed' AND (p_from IS NULL OR b.booking_date >= p_from) AND (p_to IS NULL OR b.booking_date <= p_to)) as bookings,
      COALESCE((SELECT SUM(b.total_sale_value) FROM bookings b WHERE b.advisor_id = p.id AND b.status = 'confirmed' AND (p_from IS NULL OR b.booking_date >= p_from) AND (p_to IS NULL OR b.booking_date <= p_to)), 0) as revenue
    FROM profiles p
    WHERE p.is_active = TRUE
    ORDER BY bookings DESC, revenue DESC
  ) res;
$$;
