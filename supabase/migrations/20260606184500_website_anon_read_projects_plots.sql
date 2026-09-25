-- Public website (anon key) must read active projects + their plots for listings.
CREATE POLICY projects_public_read_active ON projects
  FOR SELECT TO anon USING (is_active = true);

CREATE POLICY plots_public_read ON plots
  FOR SELECT TO anon USING (true);