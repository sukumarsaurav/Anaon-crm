
-- Performance indexes
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_next_followup ON leads(next_followup_at);
CREATE INDEX idx_leads_score ON leads(score DESC);
CREATE INDEX idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX idx_lead_activities_created_at ON lead_activities(created_at DESC);
CREATE INDEX idx_site_visits_lead_id ON site_visits(lead_id);
CREATE INDEX idx_site_visits_scheduled_at ON site_visits(scheduled_at);
CREATE INDEX idx_plots_project_id ON plots(project_id);
CREATE INDEX idx_plots_status ON plots(status);
CREATE INDEX idx_bookings_client_id ON bookings(client_id);
CREATE INDEX idx_bookings_project_id ON bookings(project_id);
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_due_date ON payments(due_date);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_notifications_user_id ON notifications(user_id, is_read);
CREATE INDEX idx_audit_logs_record ON audit_logs(table_name, record_id);

-- Fuzzy search index on leads name
CREATE INDEX idx_leads_name_trgm ON leads USING GIN(full_name gin_trgm_ops);

-- Auto-update updated_at timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_plots_updated_at BEFORE UPDATE ON plots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_site_visits_updated_at BEFORE UPDATE ON site_visits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_brokers_updated_at BEFORE UPDATE ON brokers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_broker_commissions_updated_at BEFORE UPDATE ON broker_commissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_construction_milestones_updated_at BEFORE UPDATE ON construction_milestones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_complaints_updated_at BEFORE UPDATE ON complaints FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_automations_updated_at BEFORE UPDATE ON automations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-release expired soft holds
CREATE OR REPLACE FUNCTION release_expired_holds()
RETURNS void AS $$
BEGIN
  UPDATE plots
  SET status = 'available', held_by = NULL, held_until = NULL
  WHERE status = 'soft_hold' AND held_until < NOW();
END;
$$ LANGUAGE plpgsql;

-- Lead score temperature sync
CREATE OR REPLACE FUNCTION sync_lead_temperature()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.score >= 80 THEN
    NEW.temperature = 'hot';
  ELSIF NEW.score >= 50 THEN
    NEW.temperature = 'warm';
  ELSE
    NEW.temperature = 'cold';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lead_temperature_sync
BEFORE INSERT OR UPDATE OF score ON leads
FOR EACH ROW EXECUTE FUNCTION sync_lead_temperature();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
