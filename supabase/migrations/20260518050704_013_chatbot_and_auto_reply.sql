
-- Chatbot session per conversation
CREATE TABLE chatbot_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL UNIQUE REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'greeting',
  context JSONB DEFAULT '{}',            -- {city?, budget_range?, project_id?, preferred_date?}
  turn_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  handed_off BOOLEAN DEFAULT false,
  handoff_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-reply rules (admin-configurable)
CREATE TABLE auto_reply_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 10,   -- lower = higher priority
  -- Trigger conditions
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'office_hours', 'new_contact', 'keyword', 'after_site_visit'
  )),
  trigger_config JSONB DEFAULT '{}',
  -- e.g. {"keywords": ["price","rate","cost"], "match": "any"}
  -- e.g. {"start": "09:00", "end": "19:00", "timezone": "Asia/Kolkata"}
  -- Response
  response_type TEXT NOT NULL CHECK (response_type IN ('text', 'template', 'interactive')),
  response_text TEXT,
  response_template_id UUID REFERENCES whatsapp_templates(id),
  response_buttons JSONB DEFAULT '[]',   -- for interactive quick reply
  -- Meta
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default auto-reply rules
INSERT INTO auto_reply_rules (name, priority, trigger_type, trigger_config, response_type, response_text) VALUES
  ('Out of Office Hours', 1, 'office_hours',
   '{"start": "09:00", "end": "19:00", "timezone": "Asia/Kolkata", "trigger_when": "outside"}',
   'text',
   'Thank you for reaching out to ANON INDIA. Our team will contact you shortly. Office hours: 9AM–7PM, Monday to Saturday.'),
  ('New Contact Greeting', 2, 'new_contact',
   '{}',
   'interactive',
   'Hi! Welcome to ANON INDIA 🏡 How can we help you today?'),
  ('Price Enquiry', 5, 'keyword',
   '{"keywords": ["price", "rate", "cost", "pricing", "kitna"], "match": "any"}',
   'text',
   'Thank you for your interest in our pricing! Our advisor will share the detailed cost sheet with you shortly. You can also call us at [phone] for immediate assistance.'),
  ('Location Enquiry', 5, 'keyword',
   '{"keywords": ["location", "where", "address", "kahan", "map"], "match": "any"}',
   'text',
   'Our projects are located in prime areas of Jaipur. Our advisor will share the exact location and directions. You can also check our website for project maps.'),
  ('Site Visit Request', 5, 'keyword',
   '{"keywords": ["visit", "site visit", "dekhna", "show", "tour"], "match": "any"}',
   'text',
   'We''d love to show you the property! 🏠 Please share your preferred date and time, and our advisor will arrange a personalised site visit for you.');

ALTER TABLE chatbot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_reply_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chatbot_sessions_read" ON chatbot_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "chatbot_sessions_write" ON chatbot_sessions FOR ALL TO authenticated USING (true);
CREATE POLICY "chatbot_sessions_anon" ON chatbot_sessions FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "auto_reply_rules_read" ON auto_reply_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "auto_reply_rules_write" ON auto_reply_rules FOR ALL TO authenticated USING (true);
CREATE POLICY "auto_reply_rules_anon_read" ON auto_reply_rules FOR SELECT TO anon USING (true);

CREATE TRIGGER trg_chatbot_sessions_updated_at
  BEFORE UPDATE ON chatbot_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
