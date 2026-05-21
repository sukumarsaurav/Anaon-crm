export type WaConversationStatus =
  | 'new'
  | 'assigned'
  | 'in_progress'
  | 'waiting_reply'
  | 'resolved'
  | 'closed'

export type WaMessageDirection = 'inbound' | 'outbound'

export type WaMessageType =
  | 'text'
  | 'template'
  | 'image'
  | 'document'
  | 'audio'
  | 'video'
  | 'interactive'
  | 'button_reply'
  | 'location'
  | 'sticker'
  | 'reaction'
  | 'system'

export type WaDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed'

export type WaTemplateCategory = 'marketing' | 'utility' | 'authentication'
export type WaTemplateStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'disabled'

export interface WaConversation {
  id: string
  wa_id: string
  contact_name: string | null
  contact_phone: string
  lead_id: string | null
  client_id: string | null
  assigned_to: string | null
  branch_id: string | null
  status: WaConversationStatus
  unread_count: number
  last_message_at: string | null
  last_message_preview: string | null
  is_bot_active: boolean
  bot_handoff_at: string | null
  opted_out: boolean
  opted_out_at: string | null
  source: string | null
  created_at: string
  updated_at: string
  // Joined
  assigned_profile?: { id: string; full_name: string; photo_url: string | null } | null
  lead?: { id: string; full_name: string; stage: string; score: number } | null
}

export interface WaMessage {
  id: string
  conversation_id: string
  wa_message_id: string | null
  direction: WaMessageDirection
  type: WaMessageType
  body: string | null
  template_name: string | null
  template_params: string[] | null
  media_url: string | null
  media_mime_type: string | null
  media_filename: string | null
  interactive_payload: Record<string, unknown> | null
  delivery_status: WaDeliveryStatus
  delivered_at: string | null
  read_at: string | null
  failed_reason: string | null
  sent_by: string | null
  is_bot_message: boolean
  broadcast_id: string | null
  created_at: string
  // Joined
  sender?: { id: string; full_name: string; photo_url: string | null } | null
}

export interface WaTemplate {
  id: string
  name: string
  display_name: string
  category: WaTemplateCategory
  language: string
  status: WaTemplateStatus
  header_type: string | null
  header_content: string | null
  body: string
  footer: string | null
  buttons: WaTemplateButton[]
  variable_names: string[]
  meta_template_id: string | null
  rejection_reason: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface WaTemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE'
  text: string
  value: string
}

export interface WaBroadcast {
  id: string
  name: string
  template_id: string
  audience_filters: BroadcastAudienceFilters
  audience_count: number
  scheduled_at: string | null
  sent_at: string | null
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled'
  total_sent: number
  total_delivered: number
  total_read: number
  total_replied: number
  total_failed: number
  created_by: string | null
  created_at: string
  updated_at: string
  template?: WaTemplate | null
}

export interface BroadcastAudienceFilters {
  stage?: string[]
  source?: string[]
  project_id?: string
  city?: string
  budget_min?: number
  budget_max?: number
  temperature?: string[]
}

export interface WaBroadcastRecipient {
  id: string
  broadcast_id: string
  lead_id: string | null
  client_id: string | null
  phone: string
  name: string | null
  template_variables: Record<string, string>
  wa_message_id: string | null
  status: WaDeliveryStatus
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  replied: boolean
  failed_reason: string | null
  skipped_opted_out: boolean
  created_at: string
}

export interface ChatbotSession {
  id: string
  conversation_id: string
  state: ChatbotState
  context: ChatbotContext
  turn_count: number
  is_active: boolean
  handed_off: boolean
  handoff_reason: string | null
  created_at: string
  updated_at: string
}

export type ChatbotState =
  | 'greeting'
  | 'menu'
  | 'projects__ask_city'
  | 'projects__ask_budget'
  | 'projects__show_results'
  | 'schedule_visit__ask_date'
  | 'schedule_visit__confirm'
  | 'talk_to_advisor'
  | 'payment_status'
  | 'done'

export interface ChatbotContext {
  city?: string
  budget_range?: string
  project_id?: string
  preferred_date?: string
}

export interface AutoReplyRule {
  id: string
  name: string
  is_active: boolean
  priority: number
  trigger_type: 'office_hours' | 'new_contact' | 'keyword' | 'after_site_visit'
  trigger_config: Record<string, unknown>
  response_type: 'text' | 'template' | 'interactive'
  response_text: string | null
  response_template_id: string | null
  response_buttons: Array<{ id: string; title: string }>
}

// Meta Cloud API webhook payload types
export interface MetaWebhookPayload {
  object: string
  entry: MetaEntry[]
}

export interface MetaEntry {
  id: string
  changes: MetaChange[]
}

export interface MetaChange {
  value: MetaChangeValue
  field: string
}

export interface MetaChangeValue {
  messaging_product: string
  metadata: { display_phone_number: string; phone_number_id: string }
  contacts?: MetaContact[]
  messages?: MetaInboundMessage[]
  statuses?: MetaMessageStatus[]
}

export interface MetaContact {
  profile: { name: string }
  wa_id: string
}

export interface MetaInboundMessage {
  from: string
  id: string
  timestamp: string
  type: string
  text?: { body: string }
  image?: { id: string; mime_type: string; caption?: string }
  document?: { id: string; filename: string; mime_type: string }
  audio?: { id: string; mime_type: string }
  interactive?: {
    type: string
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string }
  }
  button?: { payload: string; text: string }
}

export interface MetaMessageStatus {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipient_id: string
  errors?: Array<{ code: number; title: string }>
}

export const CONVERSATION_STATUS_CONFIG: Record<WaConversationStatus, { label: string; color: string; bg: string; border: string }> = {
  new: { label: 'New', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  assigned: { label: 'Assigned', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  in_progress: { label: 'In Progress', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  waiting_reply: { label: 'Waiting Reply', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  resolved: { label: 'Resolved', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  closed: { label: 'Closed', color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-200' },
}
