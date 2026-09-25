-- Initial chain: Sales Team (Raj) → Priya's Team (Priya)
INSERT INTO teams (id, name, leader_id, branch_id, parent_team_id) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Sales Team', '02a4825e-5712-4aee-8c21-2779076f241e', 'aaaaaaaa-0001-0001-0001-000000000001', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO teams (id, name, leader_id, branch_id, parent_team_id) VALUES
  ('11111111-0000-0000-0000-000000000002', 'Priya''s Team', '8d322828-e91b-4b68-b03b-112649321e7e', 'aaaaaaaa-0001-0001-0001-000000000001', '11111111-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Membership
UPDATE profiles SET team_id = '11111111-0000-0000-0000-000000000001', reporting_manager_id = '15a51566-c054-4dfb-9f87-4c8fd2da1dbc' WHERE id = '02a4825e-5712-4aee-8c21-2779076f241e'; -- Raj → Sales Team, reports to Admin
UPDATE profiles SET team_id = '11111111-0000-0000-0000-000000000001', reporting_manager_id = '02a4825e-5712-4aee-8c21-2779076f241e' WHERE id = '8d322828-e91b-4b68-b03b-112649321e7e'; -- Priya → Sales Team, reports to Raj
UPDATE profiles SET team_id = '11111111-0000-0000-0000-000000000002', reporting_manager_id = '8d322828-e91b-4b68-b03b-112649321e7e' WHERE id IN ('cb298231-4266-45f1-ad37-0b5fa96c8666','2f9bc962-fb41-4ead-856e-2a565761e0dd'); -- Test Agent + Amit → Priya's Team, report to Priya