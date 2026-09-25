
-- Template category (Meta's classification)
CREATE TYPE wa_template_category AS ENUM (
  'marketing', 'utility', 'authentication'
);

-- Template status
CREATE TYPE wa_template_status AS ENUM (
  'draft', 'pending_approval', 'approved', 'rejected', 'disabled'
);

-- WhatsApp message templates
CREATE TABLE whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,                     -- Meta template name (snake_case, unique per WABA)
  display_name TEXT NOT NULL,             -- Human-readable name in CRM
  category wa_template_category NOT NULL DEFAULT 'utility',
  language TEXT NOT NULL DEFAULT 'en',
  status wa_template_status NOT NULL DEFAULT 'draft',
  -- Template body
  header_type TEXT CHECK (header_type IN ('text', 'image', 'video', 'document', 'none')),
  header_content TEXT,
  body TEXT NOT NULL,                     -- Message body with {{1}} {{2}} placeholders
  footer TEXT,
  -- Buttons
  buttons JSONB DEFAULT '[]',             -- [{type: "QUICK_REPLY"|"URL"|"PHONE", text, value}]
  -- Variables metadata
  variable_names JSONB DEFAULT '[]',      -- ["name", "project_name", "advisor_name"] — maps {{1}} to name
  -- Meta fields
  meta_template_id TEXT,
  rejection_reason TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-seed the 8 templates from the spec
INSERT INTO whatsapp_templates (name, display_name, category, body, variable_names, status) VALUES
  ('welcome_lead', 'Welcome — New Lead', 'utility',
   'Hi {{1}} 👋 Thank you for your interest in {{2}} by ANON INDIA. Our advisor {{3}} will call you shortly. Meanwhile, view the project: {{4}}',
   '["name","project_name","advisor_name","project_link"]', 'draft'),
  ('site_visit_confirmation', 'Site Visit Confirmation', 'utility',
   'Hi {{1}}, your site visit to {{2}} is confirmed for {{3}} at {{4}}. Address: {{5}}. See you there! — Team ANON INDIA',
   '["name","project_name","date","time","address"]', 'draft'),
  ('site_visit_reminder', 'Site Visit Reminder', 'utility',
   'Reminder: Your visit to {{1}} is tomorrow at {{2}}. Call us if you need to reschedule: {{3}}',
   '["project_name","time","phone"]', 'draft'),
  ('followup_no_contact', 'Follow-up — No Contact', 'marketing',
   'Hi {{1}}, we tried reaching you regarding {{2}}. Please let us know the best time to call. Tap below to reply.',
   '["name","project_name"]', 'draft'),
  ('price_escalation_alert', 'Price Escalation Alert', 'marketing',
   'Important: Current pre-launch pricing for {{1}} ends on {{2}}. Lock in your unit at the best price. Call {{3}}: {{4}}',
   '["project_name","date","advisor_name","advisor_phone"]', 'draft'),
  ('payment_reminder', 'Payment Reminder', 'utility',
   'Hi {{1}}, a payment of ₹{{2}} for {{3}} is due on {{4}}. Pay here: {{5}}. Contact us for any queries.',
   '["name","amount","plot_number","due_date","payment_link"]', 'draft'),
  ('birthday_wish', 'Birthday Wish', 'marketing',
   'Happy Birthday {{1}}! 🎂 Wishing you joy and prosperity. — Team ANON INDIA',
   '["name"]', 'draft'),
  ('festival_greeting', 'Festival Greeting', 'marketing',
   'Wishing you and your family a Happy {{1}}! 🎉 — Team ANON INDIA',
   '["festival_name"]', 'draft');

-- Broadcast campaigns
CREATE TABLE whatsapp_broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  template_id UUID NOT NULL REFERENCES whatsapp_templates(id),
  -- Audience filters (stored as JSON, applied at send time)
  audience_filters JSONB NOT NULL DEFAULT '{}',
  -- e.g. {"stage": ["interested","site_visit_scheduled"], "city": "Jaipur", "project_id": "..."}
  audience_count INTEGER DEFAULT 0,
  -- Schedule
  scheduled_at TIMESTAMPTZ,              -- NULL = send immediately
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled')),
  -- Analytics
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_read INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  -- Meta
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-recipient tracking for broadcasts
CREATE TABLE whatsapp_broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broadcast_id UUID NOT NULL REFERENCES whatsapp_broadcasts(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id),
  client_id UUID REFERENCES clients(id),
  phone TEXT NOT NULL,
  name TEXT,
  -- Per-contact template variable values
  template_variables JSONB DEFAULT '{}',
  -- Delivery tracking
  wa_message_id TEXT,
  status wa_delivery_status DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied BOOLEAN DEFAULT false,
  failed_reason TEXT,
  -- Opt-out
  skipped_opted_out BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK from whatsapp_messages to broadcasts
ALTER TABLE whatsapp_messages ADD CONSTRAINT wa_messages_broadcast_fk
  FOREIGN KEY (broadcast_id) REFERENCES whatsapp_broadcasts(id);

CREATE INDEX idx_wa_broadcasts_status ON whatsapp_broadcasts(status);
CREATE INDEX idx_wa_broadcast_recipients_broadcast ON whatsapp_broadcast_recipients(broadcast_id);
CREATE INDEX idx_wa_broadcast_recipients_phone ON whatsapp_broadcast_recipients(phone);

CREATE TRIGGER trg_wa_broadcasts_updated_at
  BEFORE UPDATE ON whatsapp_broadcasts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_broadcast_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_templates_read_authenticated" ON whatsapp_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "wa_templates_write_authenticated" ON whatsapp_templates FOR ALL TO authenticated USING (true);
CREATE POLICY "wa_broadcasts_read_authenticated" ON whatsapp_broadcasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "wa_broadcasts_write_authenticated" ON whatsapp_broadcasts FOR ALL TO authenticated USING (true);
CREATE POLICY "wa_broadcast_recipients_read" ON whatsapp_broadcast_recipients FOR SELECT TO authenticated USING (true);
CREATE POLICY "wa_broadcast_recipients_write" ON whatsapp_broadcast_recipients FOR ALL TO authenticated USING (true);
