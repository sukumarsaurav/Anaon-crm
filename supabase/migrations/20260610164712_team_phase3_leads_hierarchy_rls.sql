CREATE OR REPLACE FUNCTION current_user_is_admin_or_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'));
$$;

-- Leads: visible to the assignee + everyone up the chain; unassigned to admin/manager.
DROP POLICY IF EXISTS leads_read_assigned ON leads;
CREATE POLICY leads_read_hierarchy ON leads FOR SELECT TO authenticated USING (
  assigned_to IN (SELECT current_user_visible_members())
  OR created_by = auth.uid()
  OR (assigned_to IS NULL AND current_user_is_admin_or_manager())
);

DROP POLICY IF EXISTS leads_update_assigned ON leads;
CREATE POLICY leads_update_hierarchy ON leads FOR UPDATE TO authenticated USING (
  assigned_to IN (SELECT current_user_visible_members())
  OR created_by = auth.uid()
  OR (assigned_to IS NULL AND current_user_is_admin_or_manager())
);

-- Activities (the lead's status/timeline) follow the parent lead's visibility.
DROP POLICY IF EXISTS lead_activities_read_authenticated ON lead_activities;
CREATE POLICY lead_activities_read_hierarchy ON lead_activities FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM leads l WHERE l.id = lead_activities.lead_id AND (
    l.assigned_to IN (SELECT current_user_visible_members())
    OR l.created_by = auth.uid()
    OR (l.assigned_to IS NULL AND current_user_is_admin_or_manager())
  ))
);

-- Site visits follow the parent lead's visibility.
DROP POLICY IF EXISTS site_visits_read_authenticated ON site_visits;
CREATE POLICY site_visits_read_hierarchy ON site_visits FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM leads l WHERE l.id = site_visits.lead_id AND (
    l.assigned_to IN (SELECT current_user_visible_members())
    OR l.created_by = auth.uid()
    OR (l.assigned_to IS NULL AND current_user_is_admin_or_manager())
  ))
);