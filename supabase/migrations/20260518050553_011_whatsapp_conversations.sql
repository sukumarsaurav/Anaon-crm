
-- Conversation status
CREATE TYPE wa_conversation_status AS ENUM (
  'new', 'assigned', 'in_progress', 'waiting_reply', 'resolved', 'closed'
);

-- Message direction
CREATE TYPE wa_message_direction AS ENUM ('inbound', 'outbound');

-- Message type
CREATE TYPE wa_message_type AS ENUM (
  'text', 'template', 'image', 'document', 'audio', 'video',
  'interactive', 'button_reply', 'location', 'sticker', 'reaction', 'system'
);

-- Message delivery status
CREATE TYPE wa_delivery_status AS ENUM (
  'queued', 'sent', 'delivered', 'read', 'failed'
);

-- One conversation per contact phone number
CREATE TABLE whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wa_id TEXT UNIQUE NOT NULL,          -- WhatsApp contact phone (e.g. "919876543210")
  contact_name TEXT,                   -- Name from WhatsApp profile
  contact_phone TEXT NOT NULL,         -- Formatted phone
  lead_id UUID REFERENCES leads(id),
  client_id UUID REFERENCES clients(id),
  assigned_to UUID REFERENCES profiles(id),
  branch_id UUID REFERENCES branches(id),
  status wa_conversation_status NOT NULL DEFAULT 'new',
  unread_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  -- Chatbot
  is_bot_active BOOLEAN DEFAULT true,
  bot_handoff_at TIMESTAMPTZ,
  -- Opt-out
  opted_out BOOLEAN DEFAULT false,
  opted_out_at TIMESTAMPTZ,
  -- Meta
  source TEXT,                         -- 'organic', 'click_to_wa_ad', 'webhook'
  waba_phone_number_id TEXT,           -- which WABA number received the message
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual messages
CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  wa_message_id TEXT UNIQUE,           -- Meta message ID (for dedup + status updates)
  direction wa_message_direction NOT NULL,
  type wa_message_type NOT NULL DEFAULT 'text',
  body TEXT,                           -- text content
  template_name TEXT,                  -- if type = template
  template_params JSONB,               -- variable values
  media_url TEXT,                      -- image/video/doc URL
  media_mime_type TEXT,
  media_filename TEXT,
  interactive_payload JSONB,           -- button reply / list selection payload
  delivery_status wa_delivery_status DEFAULT 'queued',
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_reason TEXT,
  sent_by UUID REFERENCES profiles(id),  -- NULL for inbound / bot messages
  is_bot_message BOOLEAN DEFAULT false,
  broadcast_id UUID,                   -- set if part of a broadcast
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wa_conversations_lead ON whatsapp_conversations(lead_id);
CREATE INDEX idx_wa_conversations_status ON whatsapp_conversations(status);
CREATE INDEX idx_wa_conversations_assigned ON whatsapp_conversations(assigned_to);
CREATE INDEX idx_wa_conversations_last_message ON whatsapp_conversations(last_message_at DESC);
CREATE INDEX idx_wa_messages_conversation ON whatsapp_messages(conversation_id, created_at DESC);
CREATE INDEX idx_wa_messages_wa_id ON whatsapp_messages(wa_message_id);

-- Updated_at trigger
CREATE TRIGGER trg_wa_conversations_updated_at
  BEFORE UPDATE ON whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_conversations_read_authenticated" ON whatsapp_conversations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "wa_conversations_write_authenticated" ON whatsapp_conversations
  FOR ALL TO authenticated USING (true);

CREATE POLICY "wa_messages_read_authenticated" ON whatsapp_messages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "wa_messages_insert_authenticated" ON whatsapp_messages
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wa_messages_update_authenticated" ON whatsapp_messages
  FOR UPDATE TO authenticated USING (true);

-- Service role policy for webhook (anon inserts from webhook route)
CREATE POLICY "wa_conversations_service_write" ON whatsapp_conversations
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "wa_messages_service_insert" ON whatsapp_messages
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "wa_messages_service_update" ON whatsapp_messages
  FOR UPDATE TO anon USING (true);
