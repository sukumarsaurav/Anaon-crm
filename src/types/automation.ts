export type TriggerEvent =
  | 'lead_created'
  | 'lead_stage_changed'
  | 'lead_assigned'
  | 'follow_up_overdue'
  | 'site_visit_scheduled'
  | 'site_visit_completed'
  | 'booking_created'
  | 'payment_received'
  | 'payment_due_approaching'
  | 'payment_overdue'
  | 'milestone_completed'
  | 'complaint_raised'
  | 'client_birthday'
  | 'booking_anniversary'
  | 'broker_commission_approved'

export type ActionType =
  | 'send_whatsapp'
  | 'send_notification'
  | 'create_followup'
  | 'change_lead_stage'
  | 'assign_to_advisor'
  | 'send_email'

export type DelayUnit = 'minutes' | 'hours' | 'days'

export interface AutomationCondition {
  field: string      // e.g. 'source', 'project_id', 'stage'
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than'
  value: string
}

export interface AutomationActionPayload {
  // send_whatsapp
  template_name?: string
  recipient?: 'lead' | 'client' | 'advisor' | 'manager'
  // send_notification
  notification_title?: string
  notification_body?: string
  notify_roles?: string[]  // ['admin','manager']
  // create_followup
  followup_note?: string
  followup_hours?: number
  // change_lead_stage
  new_stage?: string
  // assign_to_advisor
  advisor_id?: string
  assignment_mode?: 'specific' | 'round_robin'
  // send_email
  email_subject?: string
  email_body?: string
}

export interface Automation {
  id: string
  name: string
  description: string | null
  trigger_event: TriggerEvent
  conditions: AutomationCondition[]
  delay_value: number
  delay_unit: DelayUnit | null
  action_type: ActionType
  action_payload: AutomationActionPayload
  is_active: boolean
  is_template: boolean
  template_key: string | null
  run_count: number
  last_fired_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  creator?: { full_name: string } | null
}

export interface AutomationLog {
  id: string
  automation_id: string
  trigger_record_type: string | null
  trigger_record_id: string | null
  status: 'success' | 'failed' | 'skipped'
  error_message: string | null
  action_result: Record<string, unknown> | null
  lead_name: string | null
  lead_phone: string | null
  executed_at: string
  automation?: { name: string; action_type: string } | null
}

export interface AutomationContext {
  lead?: {
    id: string
    full_name: string
    phone: string
    email?: string | null
    source?: string
    stage?: string
    assigned_to?: string | null
    project_id?: string | null
    utm_source?: string | null
    score?: number | null
  }
  client?: { id: string; full_name: string; phone: string; date_of_birth?: string | null }
  booking?: { id: string; booking_date?: string; project_id?: string }
  payment?: { id: string; amount_due?: number; due_date?: string }
  milestone?: { id: string; name: string; project_id?: string }
  complaint?: { id: string; category?: string }
  advisor?: { id: string; full_name: string }
  project?: { id: string; name: string }
  extra?: Record<string, unknown>
}

export const TRIGGER_OPTIONS: { value: TriggerEvent; label: string; category: string }[] = [
  { value: 'lead_created',             label: 'Lead Created',                category: 'Lead' },
  { value: 'lead_stage_changed',       label: 'Lead Stage Changed',          category: 'Lead' },
  { value: 'lead_assigned',            label: 'Lead Assigned to Advisor',     category: 'Lead' },
  { value: 'follow_up_overdue',        label: 'Follow-up Overdue (48h)',      category: 'Lead' },
  { value: 'site_visit_scheduled',     label: 'Site Visit Scheduled',         category: 'Sales' },
  { value: 'site_visit_completed',     label: 'Site Visit Completed',         category: 'Sales' },
  { value: 'booking_created',          label: 'Booking Created',              category: 'Sales' },
  { value: 'payment_received',         label: 'Payment Received',             category: 'Finance' },
  { value: 'payment_due_approaching',  label: 'Payment Due in 7 Days',        category: 'Finance' },
  { value: 'payment_overdue',          label: 'Payment Overdue',              category: 'Finance' },
  { value: 'milestone_completed',      label: 'Construction Milestone Done',  category: 'Construction' },
  { value: 'complaint_raised',         label: 'Client Complaint Raised',      category: 'Client' },
  { value: 'client_birthday',          label: 'Client Birthday',              category: 'Client' },
  { value: 'booking_anniversary',      label: 'Booking Anniversary',          category: 'Client' },
  { value: 'broker_commission_approved', label: 'Broker Commission Approved', category: 'Broker' },
]

export const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
  { value: 'send_whatsapp',      label: 'Send WhatsApp Template' },
  { value: 'send_notification',  label: 'Send Push Notification' },
  { value: 'create_followup',    label: 'Create Follow-up Reminder' },
  { value: 'change_lead_stage',  label: 'Change Lead Stage' },
  { value: 'assign_to_advisor',  label: 'Assign to Advisor' },
  { value: 'send_email',         label: 'Send Email' },
]

export const CONDITION_FIELDS = [
  { value: 'source',      label: 'Lead Source' },
  { value: 'utm_source',  label: 'UTM Source' },
  { value: 'stage',       label: 'Lead Stage' },
  { value: 'score',       label: 'Lead Score' },
  { value: 'project_id',  label: 'Project' },
]

export const LEAD_STAGES = [
  'new', 'contacted', 'interested', 'site_visit_scheduled',
  'site_visit_done', 'negotiation', 'booked', 'not_interested', 'lost',
]

// 15 pre-built templates
export const AUTOMATION_TEMPLATES: Omit<Automation, 'id' | 'created_by' | 'created_at' | 'updated_at' | 'run_count' | 'last_fired_at' | 'creator'>[] = [
  {
    name: 'Welcome New Lead (Facebook)',
    description: 'Auto-send welcome WhatsApp when a Facebook lead comes in',
    trigger_event: 'lead_created',
    conditions: [{ field: 'utm_source', operator: 'equals', value: 'facebook' }],
    delay_value: 0, delay_unit: 'minutes',
    action_type: 'send_whatsapp',
    action_payload: { template_name: 'welcome_lead', recipient: 'lead' },
    is_active: false, is_template: true, template_key: 'welcome_facebook',
  },
  {
    name: 'Welcome New Lead (Google)',
    description: 'Auto-send welcome WhatsApp for Google Ads leads',
    trigger_event: 'lead_created',
    conditions: [{ field: 'utm_source', operator: 'equals', value: 'google' }],
    delay_value: 0, delay_unit: 'minutes',
    action_type: 'send_whatsapp',
    action_payload: { template_name: 'welcome_lead', recipient: 'lead' },
    is_active: false, is_template: true, template_key: 'welcome_google',
  },
  {
    name: 'Notify Advisor on New Lead',
    description: 'Push notification to assigned advisor when a new lead arrives',
    trigger_event: 'lead_assigned',
    conditions: [],
    delay_value: 0, delay_unit: 'minutes',
    action_type: 'send_notification',
    action_payload: { notification_title: 'New Lead Assigned', notification_body: 'You have a new lead: {{lead_name}}', notify_roles: ['sales_advisor'] },
    is_active: false, is_template: true, template_key: 'notify_advisor_new_lead',
  },
  {
    name: 'Follow-up Overdue Alert',
    description: 'Alert advisor when a lead has had no activity for 48 hours',
    trigger_event: 'follow_up_overdue',
    conditions: [],
    delay_value: 0, delay_unit: 'hours',
    action_type: 'send_notification',
    action_payload: { notification_title: 'Follow-up Overdue', notification_body: '{{lead_name}} has not been followed up in 48 hours', notify_roles: ['sales_advisor', 'manager'] },
    is_active: false, is_template: true, template_key: 'followup_overdue',
  },
  {
    name: 'Site Visit Reminder (Lead)',
    description: 'Send WhatsApp reminder to lead 1 day before scheduled site visit',
    trigger_event: 'site_visit_scheduled',
    conditions: [],
    delay_value: 23, delay_unit: 'hours',
    action_type: 'send_whatsapp',
    action_payload: { template_name: 'site_visit_reminder', recipient: 'lead' },
    is_active: false, is_template: true, template_key: 'site_visit_reminder_lead',
  },
  {
    name: 'Site Visit Thank-you',
    description: 'Send thank-you WhatsApp 2 hours after site visit is completed',
    trigger_event: 'site_visit_completed',
    conditions: [],
    delay_value: 2, delay_unit: 'hours',
    action_type: 'send_whatsapp',
    action_payload: { template_name: 'site_visit_thankyou', recipient: 'lead' },
    is_active: false, is_template: true, template_key: 'site_visit_thankyou',
  },
  {
    name: 'Booking Confirmation WhatsApp',
    description: 'Send booking confirmation to client when booking is created',
    trigger_event: 'booking_created',
    conditions: [],
    delay_value: 0, delay_unit: 'minutes',
    action_type: 'send_whatsapp',
    action_payload: { template_name: 'booking_confirmation', recipient: 'client' },
    is_active: false, is_template: true, template_key: 'booking_confirmation',
  },
  {
    name: 'Payment Due Reminder (7 Days)',
    description: 'Remind client 7 days before payment due date',
    trigger_event: 'payment_due_approaching',
    conditions: [],
    delay_value: 0, delay_unit: 'days',
    action_type: 'send_whatsapp',
    action_payload: { template_name: 'payment_reminder_7days', recipient: 'client' },
    is_active: false, is_template: true, template_key: 'payment_due_7days',
  },
  {
    name: 'Payment Due Today',
    description: 'Send WhatsApp reminder on the day of payment due date',
    trigger_event: 'payment_due_approaching',
    conditions: [],
    delay_value: 0, delay_unit: 'days',
    action_type: 'send_whatsapp',
    action_payload: { template_name: 'payment_due_today', recipient: 'client' },
    is_active: false, is_template: true, template_key: 'payment_due_today',
  },
  {
    name: 'Overdue Payment Alert',
    description: 'Alert advisor and manager when payment is overdue',
    trigger_event: 'payment_overdue',
    conditions: [],
    delay_value: 0, delay_unit: 'days',
    action_type: 'send_notification',
    action_payload: { notification_title: 'Payment Overdue', notification_body: '{{client_name}} — ₹{{amount}} overdue since {{days}} days', notify_roles: ['sales_advisor', 'manager'] },
    is_active: false, is_template: true, template_key: 'payment_overdue_alert',
  },
  {
    name: 'Client Birthday Greeting',
    description: 'Send birthday WhatsApp to client on their birthday',
    trigger_event: 'client_birthday',
    conditions: [],
    delay_value: 0, delay_unit: 'hours',
    action_type: 'send_whatsapp',
    action_payload: { template_name: 'birthday_greeting', recipient: 'client' },
    is_active: false, is_template: true, template_key: 'client_birthday',
  },
  {
    name: 'Booking Anniversary Message',
    description: 'Send anniversary WhatsApp on booking date each year',
    trigger_event: 'booking_anniversary',
    conditions: [],
    delay_value: 0, delay_unit: 'hours',
    action_type: 'send_whatsapp',
    action_payload: { template_name: 'booking_anniversary', recipient: 'client' },
    is_active: false, is_template: true, template_key: 'booking_anniversary',
  },
  {
    name: 'Milestone Completion Notify Client',
    description: 'Notify client via WhatsApp when construction milestone is completed',
    trigger_event: 'milestone_completed',
    conditions: [],
    delay_value: 0, delay_unit: 'hours',
    action_type: 'send_whatsapp',
    action_payload: { template_name: 'milestone_update', recipient: 'client' },
    is_active: false, is_template: true, template_key: 'milestone_completed_client',
  },
  {
    name: 'Complaint Acknowledgement',
    description: 'Auto-acknowledge complaint via WhatsApp within minutes of it being raised',
    trigger_event: 'complaint_raised',
    conditions: [],
    delay_value: 5, delay_unit: 'minutes',
    action_type: 'send_whatsapp',
    action_payload: { template_name: 'complaint_acknowledgement', recipient: 'client' },
    is_active: false, is_template: true, template_key: 'complaint_ack',
  },
  {
    name: 'Broker Commission Approved',
    description: 'Notify broker via WhatsApp when commission is approved',
    trigger_event: 'broker_commission_approved',
    conditions: [],
    delay_value: 0, delay_unit: 'minutes',
    action_type: 'send_whatsapp',
    action_payload: { template_name: 'commission_approved', recipient: 'lead' },
    is_active: false, is_template: true, template_key: 'broker_commission',
  },
]
