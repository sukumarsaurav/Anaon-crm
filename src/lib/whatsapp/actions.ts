'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { sendTextMessage, sendTemplateMessage, renderTemplate } from './provider'
import { getTemplateById } from './queries'

export async function sendMessage(conversationId: string, text: string) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('contact_phone, opted_out')
    .eq('id', conversationId)
    .single()

  if (!conv) return { success: false, error: 'Conversation not found' }
  if (conv.opted_out) return { success: false, error: 'Contact has opted out' }

  const result = await sendTextMessage(conv.contact_phone, text)

  if (!result.success) return { success: false, error: result.error }

  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    wa_message_id: result.messageId,
    direction: 'outbound',
    type: 'text',
    body: text,
    delivery_status: 'sent',
    sent_by: user.id,
    is_bot_message: false,
  })

  await supabase.from('whatsapp_conversations').update({
    last_message_at: new Date().toISOString(),
    last_message_preview: text.slice(0, 100),
    status: 'in_progress',
    updated_at: new Date().toISOString(),
  }).eq('id', conversationId)

  revalidatePath(`/whatsapp/inbox/${conversationId}`)
  return { success: true }
}

export async function sendTemplateToConversation(
  conversationId: string,
  templateId: string,
  variableValues: Record<string, string>
) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const [conv, template] = await Promise.all([
    supabase.from('whatsapp_conversations').select('contact_phone, opted_out').eq('id', conversationId).single(),
    getTemplateById(templateId),
  ])

  if (!conv.data) return { success: false, error: 'Conversation not found' }
  if (conv.data.opted_out) return { success: false, error: 'Contact has opted out' }
  if (!template) return { success: false, error: 'Template not found' }

  const variables = template.variable_names.map((name) => variableValues[name] ?? '')
  const result = await sendTemplateMessage(conv.data.contact_phone, template.name, template.language, variables)

  if (!result.success) return { success: false, error: result.error }

  const renderedBody = renderTemplate(template.body, template.variable_names, variableValues)

  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    wa_message_id: result.messageId,
    direction: 'outbound',
    type: 'template',
    body: renderedBody,
    template_name: template.name,
    template_params: template.variable_names.map((n) => variableValues[n] ?? ''),
    delivery_status: 'sent',
    sent_by: user.id,
    is_bot_message: false,
  })

  await supabase.from('whatsapp_conversations').update({
    last_message_at: new Date().toISOString(),
    last_message_preview: `[Template] ${template.display_name}`,
    updated_at: new Date().toISOString(),
  }).eq('id', conversationId)

  revalidatePath(`/whatsapp/inbox/${conversationId}`)
  return { success: true }
}

export async function assignConversation(conversationId: string, advisorId: string) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase.from('whatsapp_conversations').update({
    assigned_to: advisorId,
    status: 'assigned',
    updated_at: new Date().toISOString(),
  }).eq('id', conversationId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/whatsapp/inbox')
  revalidatePath(`/whatsapp/inbox/${conversationId}`)
  return { success: true }
}

export async function resolveConversation(conversationId: string) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase.from('whatsapp_conversations').update({
    status: 'resolved',
    updated_at: new Date().toISOString(),
  }).eq('id', conversationId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/whatsapp/inbox')
  revalidatePath(`/whatsapp/inbox/${conversationId}`)
  return { success: true }
}

export async function markConversationRead(conversationId: string) {
  const supabase = await createClient()
  await supabase.from('whatsapp_conversations').update({
    unread_count: 0,
    updated_at: new Date().toISOString(),
  }).eq('id', conversationId)
  revalidatePath('/whatsapp/inbox')
}

export async function takeBotControl(conversationId: string, enableBot: boolean) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const updates: Record<string, unknown> = {
    is_bot_active: enableBot,
    updated_at: new Date().toISOString(),
  }
  if (!enableBot) {
    updates.bot_handoff_at = new Date().toISOString()
  }

  const { error } = await supabase.from('whatsapp_conversations').update(updates).eq('id', conversationId)
  if (error) return { success: false, error: error.message }

  if (!enableBot) {
    await supabase.from('chatbot_sessions')
      .update({ is_active: false, handed_off: true, handoff_reason: 'manual', updated_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('is_active', true)
  }

  revalidatePath(`/whatsapp/inbox/${conversationId}`)
  return { success: true }
}

export async function createTemplate(formData: FormData) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const body = formData.get('body') as string
  // Extract variable names from {{name}} placeholders
  const varMatches = body.match(/\{\{([^}]+)\}\}/g) ?? []
  const variableNames = [...new Set(varMatches.map((m) => m.replace(/\{\{|\}\}/g, '')))]

  const { error } = await supabase.from('whatsapp_templates').insert({
    name: formData.get('name') as string,
    display_name: formData.get('display_name') as string,
    category: formData.get('category') as string,
    language: (formData.get('language') as string) || 'en',
    status: 'draft',
    header_type: formData.get('header_type') as string || null,
    header_content: formData.get('header_content') as string || null,
    body,
    footer: formData.get('footer') as string || null,
    buttons: [],
    variable_names: variableNames,
    is_active: false,
    created_by: user.id,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/whatsapp/templates')
  return { success: true }
}

export async function updateTemplate(id: string, formData: FormData) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const body = formData.get('body') as string
  const varMatches = body.match(/\{\{([^}]+)\}\}/g) ?? []
  const variableNames = [...new Set(varMatches.map((m) => m.replace(/\{\{|\}\}/g, '')))]

  const { error } = await supabase.from('whatsapp_templates').update({
    display_name: formData.get('display_name') as string,
    body,
    footer: formData.get('footer') as string || null,
    variable_names: variableNames,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/whatsapp/templates')
  return { success: true }
}

export async function toggleTemplateActive(id: string, isActive: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.from('whatsapp_templates').update({
    is_active: isActive,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/whatsapp/templates')
  return { success: true }
}

export async function createBroadcast(formData: FormData) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const audienceFilters = JSON.parse(formData.get('audience_filters') as string ?? '{}')

  const { data, error } = await supabase.from('whatsapp_broadcasts').insert({
    name: formData.get('name') as string,
    template_id: formData.get('template_id') as string,
    audience_filters: audienceFilters,
    audience_count: 0,
    scheduled_at: formData.get('scheduled_at') as string || null,
    status: 'draft',
    total_sent: 0,
    total_delivered: 0,
    total_read: 0,
    total_replied: 0,
    total_failed: 0,
    created_by: user.id,
  }).select('id').single()

  if (error || !data) return { success: false, error: error?.message ?? 'Failed to create' }
  revalidatePath('/whatsapp/broadcasts')
  return { success: true, id: data.id }
}

export async function sendBroadcast(broadcastId: string) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  // Fetch broadcast + template
  const { data: broadcast } = await supabase
    .from('whatsapp_broadcasts')
    .select('*, template:whatsapp_templates(*)')
    .eq('id', broadcastId)
    .single()

  if (!broadcast) return { success: false, error: 'Broadcast not found' }
  if (broadcast.status !== 'draft' && broadcast.status !== 'scheduled') {
    return { success: false, error: 'Broadcast already sent or in progress' }
  }

  // Build lead query based on audience filters
  const filters = broadcast.audience_filters as Record<string, unknown>
  let leadsQuery = supabase
    .from('leads')
    .select('id, full_name, phone, email')
    .eq('is_deleted', false)
    .not('phone', 'is', null)

  if (Array.isArray(filters.stage) && filters.stage.length) leadsQuery = leadsQuery.in('stage', filters.stage as string[])
  if (Array.isArray(filters.source) && filters.source.length) leadsQuery = leadsQuery.in('source', filters.source as string[])
  if (filters.project_id) leadsQuery = leadsQuery.eq('project_id', filters.project_id as string)
  if (filters.city) leadsQuery = leadsQuery.ilike('preferred_city', `%${filters.city}%`)
  if (filters.budget_min) leadsQuery = leadsQuery.gte('budget_min', filters.budget_min)
  if (filters.budget_max) leadsQuery = leadsQuery.lte('budget_max', filters.budget_max)

  const { data: leads } = await leadsQuery.limit(1000)
  if (!leads?.length) return { success: false, error: 'No leads match the audience filters' }

  // Mark broadcast as sending
  await supabase.from('whatsapp_broadcasts').update({
    status: 'sending',
    sent_at: new Date().toISOString(),
    audience_count: leads.length,
  }).eq('id', broadcastId)

  const template = broadcast.template
  let totalSent = 0
  let totalFailed = 0

  // Send to each lead
  for (const lead of leads) {
    const phone = lead.phone as string
    // Check opt-out
    const { data: existingConv } = await supabase
      .from('whatsapp_conversations')
      .select('opted_out')
      .eq('contact_phone', phone)
      .single()

    if (existingConv?.opted_out) {
      await supabase.from('broadcast_recipients').insert({
        broadcast_id: broadcastId,
        lead_id: lead.id,
        phone,
        name: lead.full_name,
        template_variables: {},
        status: 'failed',
        failed_reason: 'opted_out',
        skipped_opted_out: true,
      })
      continue
    }

    const variables = template.variable_names.map((name: string) => {
      if (name === 'name' || name === 'full_name') return lead.full_name ?? 'there'
      return ''
    })

    const result = await sendTemplateMessage(phone, template.name, template.language, variables)

    const recipientData: Record<string, unknown> = {
      broadcast_id: broadcastId,
      lead_id: lead.id,
      phone,
      name: lead.full_name,
      template_variables: Object.fromEntries(template.variable_names.map((n: string, i: number) => [n, variables[i]])),
      status: result.success ? 'sent' : 'failed',
      skipped_opted_out: false,
    }
    if (result.success) {
      recipientData.wa_message_id = result.messageId
      recipientData.sent_at = new Date().toISOString()
      totalSent++
    } else {
      recipientData.failed_reason = result.error
      totalFailed++
    }

    await supabase.from('broadcast_recipients').insert(recipientData)
  }

  await supabase.from('whatsapp_broadcasts').update({
    status: 'sent',
    total_sent: totalSent,
    total_failed: totalFailed,
  }).eq('id', broadcastId)

  revalidatePath('/whatsapp/broadcasts')
  revalidatePath(`/whatsapp/broadcasts/${broadcastId}`)
  return { success: true, totalSent, totalFailed }
}

export async function saveAutoReplyRule(formData: FormData) {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }

  const id = formData.get('id') as string | null
  const payload = {
    name: formData.get('name') as string,
    is_active: formData.get('is_active') === 'true',
    priority: parseInt(formData.get('priority') as string, 10) || 10,
    trigger_type: formData.get('trigger_type') as string,
    trigger_config: JSON.parse(formData.get('trigger_config') as string ?? '{}'),
    response_type: formData.get('response_type') as string,
    response_text: formData.get('response_text') as string || null,
    response_template_id: formData.get('response_template_id') as string || null,
    response_buttons: JSON.parse(formData.get('response_buttons') as string ?? '[]'),
  }

  let error
  if (id) {
    ;({ error } = await supabase.from('auto_reply_rules').update(payload).eq('id', id))
  } else {
    ;({ error } = await supabase.from('auto_reply_rules').insert(payload))
  }

  if (error) return { success: false, error: error.message }
  revalidatePath('/whatsapp/auto-reply')
  return { success: true }
}
