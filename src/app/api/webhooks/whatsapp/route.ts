import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyWebhookSignature, markMessageRead } from '@/lib/whatsapp/provider'
import { runAutoReplyRules } from '@/lib/whatsapp/auto-reply'
import { processBotMessage } from '@/lib/whatsapp/chatbot'
import type {
  MetaWebhookPayload,
  MetaInboundMessage,
  MetaContact,
  MetaMessageStatus,
  ChatbotSession,
} from '@/types/whatsapp'

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? ''
const APP_SECRET = process.env.WHATSAPP_APP_SECRET ?? ''

// GET — webhook verification handshake
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// POST — inbound messages + status updates
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Verify signature
  const signature = req.headers.get('x-hub-signature-256') ?? ''
  if (APP_SECRET && !verifyWebhookSignature(signature, rawBody, APP_SECRET)) {
    return new NextResponse('Invalid signature', { status: 401 })
  }

  let payload: MetaWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new NextResponse('Bad JSON', { status: 400 })
  }

  if (payload.object !== 'whatsapp_business_account') {
    return new NextResponse('OK', { status: 200 })
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      const value = change.value

      // Process status updates
      for (const status of value.statuses ?? []) {
        await handleStatusUpdate(status)
      }

      // Build contact map
      const contactMap = new Map<string, MetaContact>()
      for (const c of value.contacts ?? []) {
        contactMap.set(c.wa_id, c)
      }

      // Process inbound messages
      for (const msg of value.messages ?? []) {
        const contact = contactMap.get(msg.from)
        await handleInboundMessage(msg, contact)
      }
    }
  }

  return new NextResponse('OK', { status: 200 })
}

async function handleStatusUpdate(status: MetaMessageStatus) {
  const supabase = await createClient()
  const updates: Record<string, unknown> = {
    delivery_status: status.status,
  }
  if (status.status === 'delivered') updates.delivered_at = new Date(parseInt(status.timestamp) * 1000).toISOString()
  if (status.status === 'read') updates.read_at = new Date(parseInt(status.timestamp) * 1000).toISOString()
  if (status.status === 'failed' && status.errors?.[0]) {
    updates.failed_reason = status.errors[0].title
  }

  await supabase
    .from('whatsapp_messages')
    .update(updates)
    .eq('wa_message_id', status.id)

  // Update broadcast recipient if applicable
  if (status.status === 'delivered' || status.status === 'read') {
    await supabase
      .from('broadcast_recipients')
      .update({
        status: status.status,
        ...(status.status === 'delivered' ? { delivered_at: updates.delivered_at } : {}),
        ...(status.status === 'read' ? { read_at: updates.read_at } : {}),
      })
      .eq('wa_message_id', status.id)
  }
}

async function handleInboundMessage(msg: MetaInboundMessage, contact: MetaContact | undefined) {
  const supabase = await createClient()
  const phone = msg.from
  const contactName = contact?.profile?.name ?? null
  const timestamp = new Date(parseInt(msg.timestamp) * 1000).toISOString()

  // Extract text from various message types
  let bodyText = ''
  let msgType = msg.type
  if (msg.type === 'text' && msg.text) {
    bodyText = msg.text.body
  } else if (msg.type === 'interactive') {
    msgType = 'button_reply'
    bodyText = msg.interactive?.button_reply?.id ?? msg.interactive?.list_reply?.id ?? ''
  } else if (msg.type === 'button' && msg.button) {
    msgType = 'button_reply'
    bodyText = msg.button.payload
  }

  // Upsert conversation
  const { data: existingConv } = await supabase
    .from('whatsapp_conversations')
    .select('id, unread_count, is_bot_active, opted_out, lead_id')
    .eq('contact_phone', phone)
    .single()

  let conversationId: string
  let isNewContact = false

  if (existingConv) {
    conversationId = existingConv.id
    await supabase.from('whatsapp_conversations').update({
      contact_name: contactName ?? undefined,
      unread_count: (existingConv.unread_count ?? 0) + 1,
      last_message_at: timestamp,
      last_message_preview: bodyText.slice(0, 100),
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    }).eq('id', conversationId)
  } else {
    isNewContact = true
    // Try to find matching lead
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('phone', phone)
      .eq('is_deleted', false)
      .single()

    const { data: newConv, error: convError } = await supabase
      .from('whatsapp_conversations')
      .insert({
        wa_id: phone,
        contact_phone: phone,
        contact_name: contactName,
        lead_id: lead?.id ?? null,
        status: 'new',
        unread_count: 1,
        last_message_at: timestamp,
        last_message_preview: bodyText.slice(0, 100),
        is_bot_active: true,
        source: 'inbound',
      })
      .select('id')
      .single()

    if (convError || !newConv) return
    conversationId = newConv.id
  }

  // Store the message
  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    wa_message_id: msg.id,
    direction: 'inbound',
    type: msgType,
    body: bodyText || null,
    interactive_payload: msg.interactive ?? null,
    delivery_status: 'delivered',
    delivered_at: timestamp,
    is_bot_message: false,
    created_at: timestamp,
  })

  // Mark as read on Meta
  await markMessageRead(msg.id)

  // If opted out, skip auto-replies
  if (existingConv?.opted_out) return

  // Run auto-reply rules
  const { data: rules } = await supabase.from('auto_reply_rules').select('*').order('priority')
  const autoReplyResult = await runAutoReplyRules(phone, bodyText, isNewContact, rules ?? [])

  if (autoReplyResult.matched) {
    // Log auto-reply message in DB
    await supabase.from('whatsapp_messages').insert({
      conversation_id: conversationId,
      direction: 'outbound',
      type: 'text',
      body: `[Auto-reply: ${autoReplyResult.ruleName}]`,
      delivery_status: 'sent',
      is_bot_message: true,
    })
    return
  }

  // Run chatbot if active
  const isBotActive = existingConv ? existingConv.is_bot_active : true
  if (!isBotActive || !bodyText) return

  // Load or create chatbot session
  let session: ChatbotSession | null = null
  const { data: existingSession } = await supabase
    .from('chatbot_sessions')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('is_active', true)
    .single()

  if (existingSession) {
    session = existingSession as ChatbotSession
  } else {
    const { data: newSession } = await supabase
      .from('chatbot_sessions')
      .insert({
        conversation_id: conversationId,
        state: 'greeting',
        context: {},
        turn_count: 0,
        is_active: true,
        handed_off: false,
      })
      .select('*')
      .single()
    session = newSession as ChatbotSession
  }

  if (!session) return

  // Fetch projects for bot context
  const { data: projects } = await supabase
    .from('projects')
    .select('name, city, type')
    .eq('is_active', true)

  const result = await processBotMessage(
    phone,
    bodyText,
    session,
    projects ?? []
  )

  // Update session
  await supabase.from('chatbot_sessions').update({
    state: result.nextState,
    context: result.context,
    turn_count: (session.turn_count ?? 0) + 1,
    is_active: !result.handoff,
    handed_off: result.handoff,
    handoff_reason: result.handoffReason ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', session.id)

  if (result.handoff) {
    // Mark bot as inactive, set status to new for human pickup
    await supabase.from('whatsapp_conversations').update({
      is_bot_active: false,
      bot_handoff_at: new Date().toISOString(),
      status: 'new',
      updated_at: new Date().toISOString(),
    }).eq('id', conversationId)

    // If we captured a preferred date (visit request), create a lead if none exists
    if (result.handoffReason === 'visit_requested' && !existingConv?.lead_id) {
      const { data: newLead } = await supabase.from('leads').insert({
        full_name: contactName ?? phone,
        phone,
        source: 'whatsapp',
        stage: 'new',
        preferred_city: result.context.city ?? null,
        budget_min: null,
        budget_max: null,
        notes: `WhatsApp chatbot lead. Budget: ${result.context.budget_range ?? 'unknown'}. Preferred date: ${result.context.preferred_date ?? 'unknown'}`,
        score: 50,
        temperature: 'warm',
      }).select('id').single()

      if (newLead) {
        await supabase.from('whatsapp_conversations').update({
          lead_id: newLead.id,
        }).eq('id', conversationId)
      }
    }
  }
}
