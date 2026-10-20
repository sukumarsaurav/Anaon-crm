'use server'

import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { signWhatsAppMedia } from './media'
import { searchOr } from '@/lib/supabase/search'
import type { WaConversation, WaMessage, WaTemplate, WaBroadcast } from '@/types/whatsapp'

export async function getConversations(filters: {
  status?: string
  assigned_to?: string
  search?: string
} = {}): Promise<WaConversation[]> {
  const supabase = await createClient()
  const session = await getProfile()
  if (!session?.user) return []
  const { user, profile } = session

  let query = supabase
    .from('whatsapp_conversations')
    .select(`
      *,
      assigned_profile:profiles!whatsapp_conversations_assigned_to_fkey(id, full_name, photo_url),
      lead:leads(id, full_name, stage, score)
    `)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  // Role-based scoping
  if (profile?.role === 'sales_advisor' || profile?.role === 'telecaller') {
    query = query.eq('assigned_to', user.id)
  } else if (profile?.role === 'manager' && profile?.branch_id) {
    query = query.eq('branch_id', profile.branch_id)
  }

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to)
  const search = searchOr(filters.search, { text: ['contact_name'], phone: ['contact_phone'] })
  if (search) query = query.or(search)

  const { data, error } = await query.limit(100)
  if (error) return []
  return data as WaConversation[]
}

export async function getConversationById(id: string): Promise<WaConversation | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select(`
      *,
      assigned_profile:profiles!whatsapp_conversations_assigned_to_fkey(id, full_name, photo_url),
      lead:leads(id, full_name, stage, score, phone)
    `)
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data as WaConversation
}

export async function getMessages(conversationId: string): Promise<WaMessage[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select(`
      *,
      sender:profiles!whatsapp_messages_sent_by_fkey(id, full_name, photo_url)
    `)
    .eq('conversation_id', conversationId)
    // The latest 200, shown oldest-first. Ascending + limit would show a long chat's first
    // 200 messages and never its newest.
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return []
  // Read through RLS above, so the reader may see these; only then sign the files.
  return signWhatsAppMedia((data as WaMessage[]).reverse())
}

export async function getTemplates(activeOnly = true): Promise<WaTemplate[]> {
  const supabase = await createClient()
  let query = supabase
    .from('whatsapp_templates')
    .select('*')
    .order('display_name')
  if (activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) return []
  return data as WaTemplate[]
}

export async function getTemplateById(id: string): Promise<WaTemplate | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .eq('id', id)
    .single()
  return data as WaTemplate | null
}

export async function getBroadcasts(): Promise<WaBroadcast[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('whatsapp_broadcasts')
    .select('*, template:whatsapp_templates(id, display_name, name, body)')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return []
  return data as WaBroadcast[]
}

export async function getBroadcastById(id: string): Promise<WaBroadcast | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('whatsapp_broadcasts')
    .select('*, template:whatsapp_templates(*)')
    .eq('id', id)
    .single()
  return data as WaBroadcast | null
}

export async function getConversationStats() {
  const supabase = await createClient()
  // Counts, not rows: loading every conversation stopped at PostgREST's 1,000-row cap.
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0)
  const base = () => supabase.from('whatsapp_conversations').select('id', { count: 'exact', head: true })
  const [total, unread, newConvos, open] = await Promise.all([
    count(base()),
    count(base().gt('unread_count', 0)),
    count(base().eq('status', 'new')),
    count(base().not('status', 'in', '(resolved,closed)')),
  ])
  return { total, unread, new: newConvos, open }
}

export async function getAutoReplyRules() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('auto_reply_rules')
    .select('*')
    .order('priority')
  return data ?? []
}
