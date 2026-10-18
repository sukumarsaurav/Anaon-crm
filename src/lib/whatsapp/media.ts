import { createServiceClient } from '@/lib/supabase/service'

/**
 * WhatsApp attachments. AgencyX delivers a file as a signed link that stops working after
 * seven days, so each one is copied into the private `whatsapp-media` bucket and the
 * message's media_url is repointed at it (`storage://whatsapp-media/<path>`).
 *
 * Plain module (service client): called from the webhook after it has answered, and from
 * the inbox query, which has already checked the reader may see the message.
 */

const BUCKET = 'whatsapp-media'
const PREFIX = `storage://${BUCKET}/`
const SIGNED_URL_SECONDS = 60 * 60

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/3gpp': '3gp',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/amr': 'amr',
  'application/pdf': 'pdf', 'text/plain': 'txt',
}

function extensionFor(mime: string | null, filename: string | null): string {
  const fromName = filename?.match(/\.([a-z0-9]{1,5})$/i)?.[1]
  if (fromName) return fromName.toLowerCase()
  const base = (mime ?? '').split(';')[0].trim().toLowerCase()
  return EXT[base] ?? 'bin'
}

/**
 * Copies one message's attachment into storage. Safe to call twice: a message already
 * pointing at storage is left alone. Failures are logged, not thrown — the original link
 * still works for a week, and the next call can try again.
 */
export async function persistWhatsAppMedia(waMessageId: string | null | undefined): Promise<void> {
  if (!waMessageId) return
  const supabase = createServiceClient()
  const { data: msg } = await supabase
    .from('whatsapp_messages')
    .select('id, conversation_id, media_url, media_mime_type, media_filename')
    .eq('wa_message_id', waMessageId)
    .maybeSingle()
  if (!msg?.media_url || !/^https:\/\//.test(msg.media_url)) return

  try {
    const res = await fetch(msg.media_url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`download failed (${res.status})`)
    const mime = msg.media_mime_type ?? res.headers.get('content-type')
    const bytes = new Uint8Array(await res.arrayBuffer())
    const path = `${msg.conversation_id}/${msg.id}.${extensionFor(mime, msg.media_filename)}`

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: mime ?? 'application/octet-stream',
      upsert: true,
    })
    if (upErr) throw upErr
    await supabase.from('whatsapp_messages').update({ media_url: `${PREFIX}${path}` }).eq('id', msg.id)
  } catch (err) {
    console.error('[whatsapp] could not store media for', waMessageId, err)
  }
}

/**
 * Turns stored attachment paths into short-lived signed URLs for display. Messages whose
 * media still lives at AgencyX's link are returned unchanged.
 */
export async function signWhatsAppMedia<T extends { media_url: string | null }>(messages: T[]): Promise<T[]> {
  const paths = messages
    .map((m) => m.media_url)
    .filter((u): u is string => Boolean(u?.startsWith(PREFIX)))
    .map((u) => u.slice(PREFIX.length))
  if (!paths.length) return messages

  const { data } = await createServiceClient().storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)
  const signed = new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]))
  return messages.map((m) =>
    m.media_url?.startsWith(PREFIX)
      ? { ...m, media_url: signed.get(m.media_url.slice(PREFIX.length)) ?? null }
      : m,
  )
}
