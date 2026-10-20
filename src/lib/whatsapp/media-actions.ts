'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getProfile } from '@/lib/supabase/getProfile'
import { agencyXConfigured, sendViaAgencyX } from './agencyx-api'
import { toWhatsAppNumber } from './phone'
import { FILES_BUCKET, fileUrl } from '@/lib/files/storage'

/**
 * Send an image or document (brochure, price list, layout) from the inbox. The file is uploaded first
 * to `crm-files/whatsapp/<conversation>/…` with FileUrlInput's signed slot; WhatsApp fetches it through
 * a short-lived signed URL. The send helper existed, but the inbox could only send text.
 */
export async function sendInboxMedia(input: {
  conversationId: string
  path: string
  filename: string
  mimeType: string
  caption?: string
}): Promise<{ success: boolean; error?: string }> {
  const user = (await getProfile())?.user
  if (!user) return { success: false, error: 'Unauthorized' }
  if (!agencyXConfigured()) return { success: false, error: 'Sending files needs the AgencyX connection (AGENCYX_API_KEY)' }
  if (!input.path.startsWith(`whatsapp/${input.conversationId}/`)) return { success: false, error: 'Upload the file from this conversation' }

  // The caller's own client: only a conversation this user can see.
  const supabase = await createClient()
  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('contact_phone, waba_phone_number_id')
    .eq('id', input.conversationId)
    .single()
  if (!conv) return { success: false, error: 'Conversation not found' }

  const type: 'image' | 'document' = input.mimeType.startsWith('image/') ? 'image' : 'document'
  const svc = createServiceClient()
  const { data: signed, error: signErr } = await svc.storage.from(FILES_BUCKET).createSignedUrl(input.path, 3600)
  if (signErr || !signed) return { success: false, error: 'Could not prepare the file' }

  const to = toWhatsAppNumber(conv.contact_phone) ?? conv.contact_phone
  const caption = input.caption?.trim() || undefined
  const result = await sendViaAgencyX({
    to,
    from: conv.waba_phone_number_id,
    media: { type, url: signed.signedUrl, filename: type === 'document' ? input.filename : undefined, caption },
    pauseAutoReply: true,
  })
  if (!result.success) return { success: false, error: result.error }

  const now = new Date().toISOString()
  const row = {
    conversation_id: input.conversationId,
    wa_message_id: result.messageId ?? null,
    direction: 'outbound',
    type,
    body: caption ?? null,
    media_url: fileUrl(input.path),
    media_mime_type: input.mimeType,
    media_filename: input.filename,
    delivery_status: 'sent',
    sent_by: user.id,
    is_bot_message: false,
  }
  const { error } = row.wa_message_id
    ? await supabase.from('whatsapp_messages').upsert(row, { onConflict: 'wa_message_id' })
    : await supabase.from('whatsapp_messages').insert(row)
  if (error) console.error('[whatsapp] failed to record sent media', error)

  await supabase.from('whatsapp_conversations').update({
    last_message_at: now,
    last_message_preview: caption ? `📎 ${caption}`.slice(0, 100) : `📎 ${input.filename}`.slice(0, 100),
    status: 'in_progress',
    updated_at: now,
    is_bot_active: false,
    bot_handoff_at: now,
  }).eq('id', input.conversationId)

  revalidatePath(`/whatsapp/inbox/${input.conversationId}`)
  return { success: true }
}
