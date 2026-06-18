import { createServiceClient } from '@/lib/supabase/service'
import { sendExpoPush, sendWebPush, type PushPayload } from './push'

export interface NotifyInput {
  title: string
  message: string
  type?: string
  related_type?: string | null
  related_id?: string | null
  action_url?: string | null
}

/**
 * Create in-app notifications for the given users AND fan out to their push
 * devices (Expo + Web Push). Single source of truth for notifications.
 * Never throws — push/db failures are logged, not propagated.
 */
export async function notifyUsers(userIds: string[], input: NotifyInput): Promise<void> {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (ids.length === 0) return

  const supabase = createServiceClient()

  // 1. In-app notification rows
  try {
    await supabase.from('notifications').insert(
      ids.map((user_id) => ({
        user_id,
        title: input.title,
        body: input.message,
        type: input.type ?? 'system',
        related_record_type: input.related_type ?? null,
        related_record_id: input.related_id ?? null,
        action_url: input.action_url ?? null,
      })),
    )
  } catch (e) {
    console.error('[notify] insert failed:', e)
  }

  // 2. Push fan-out
  try {
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('endpoint, platform, expo_token, web_subscription')
      .in('user_id', ids)
    if (!tokens?.length) return

    const payload: PushPayload = {
      title: input.title,
      body: input.message,
      url: input.action_url ?? undefined,
    }

    const expoTokens = tokens.filter((t) => t.platform === 'expo' && t.expo_token).map((t) => t.expo_token as string)
    const webSubs = tokens.filter((t) => t.platform === 'web' && t.web_subscription)

    const deadEndpoints: string[] = []

    const deadExpo = await sendExpoPush(expoTokens, payload)
    // expo endpoint == expo_token in our schema
    deadEndpoints.push(...deadExpo)

    await Promise.all(
      webSubs.map(async (t) => {
        const { dead } = await sendWebPush(t.web_subscription, payload)
        if (dead) deadEndpoints.push(t.endpoint)
      }),
    )

    if (deadEndpoints.length) {
      await supabase.from('push_tokens').delete().in('endpoint', deadEndpoints)
    }
  } catch (e) {
    console.error('[notify] push fan-out failed:', e)
  }
}
