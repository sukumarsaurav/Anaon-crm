
-- Marketing campaigns table for ad spend tracking
CREATE TABLE marketing_campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  platform        text NOT NULL CHECK (platform IN ('facebook', 'instagram', 'google', 'youtube', 'whatsapp', 'portal99acres', 'magicbricks', 'housing', 'other')),
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,
  start_date      date NOT NULL,
  end_date        date,
  budget          numeric(12,2) DEFAULT 0,
  spend           numeric(12,2) DEFAULT 0,
  objective       text CHECK (objective IN ('lead_generation', 'awareness', 'retargeting', 'conversion')),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  meta_campaign_id   text,
  meta_adset_id      text,
  meta_ad_id         text,
  notes           text,
  created_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Spend entries for granular tracking (daily/weekly spend logs)
CREATE TABLE campaign_spend_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  log_date        date NOT NULL,
  spend           numeric(10,2) NOT NULL DEFAULT 0,
  impressions     integer DEFAULT 0,
  clicks          integer DEFAULT 0,
  reach           integer DEFAULT 0,
  notes           text,
  logged_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Meta webhook event dedup log
CREATE TABLE meta_lead_webhook_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        text UNIQUE NOT NULL,
  leadgen_id      text,
  form_id         text,
  page_id         text,
  ad_id           text,
  campaign_id     text,
  adset_id        text,
  payload         jsonb,
  lead_id         uuid REFERENCES leads(id) ON DELETE SET NULL,
  processed       boolean DEFAULT false,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_spend_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_lead_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage marketing_campaigns"
  ON marketing_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage campaign_spend_logs"
  ON campaign_spend_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view meta webhook events"
  ON meta_lead_webhook_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manages meta webhook events"
  ON meta_lead_webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_marketing_campaigns_platform ON marketing_campaigns(platform);
CREATE INDEX idx_marketing_campaigns_utm_source ON marketing_campaigns(utm_source);
CREATE INDEX idx_marketing_campaigns_utm_campaign ON marketing_campaigns(utm_campaign);
CREATE INDEX idx_marketing_campaigns_project_id ON marketing_campaigns(project_id);
CREATE INDEX idx_campaign_spend_logs_campaign_id ON campaign_spend_logs(campaign_id);
CREATE INDEX idx_campaign_spend_logs_date ON campaign_spend_logs(log_date);
CREATE INDEX idx_leads_utm_source ON leads(utm_source);
CREATE INDEX idx_leads_utm_campaign ON leads(utm_campaign);
CREATE INDEX idx_meta_webhook_event_id ON meta_lead_webhook_events(event_id);
