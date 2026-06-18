/**
 * Push delivery — Expo (mobile) + Web Push (browser).
 *
 * Env vars:
 *   EXPO_ACCESS_TOKEN              — optional, for Expo push security
 *   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY — web-push VAPID keypair
 *   VAPID_SUBJECT                  — mailto: or https URL (default mailto:no-reply@anonindia.com)
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY   — same public key, exposed to the browser
 */

import webpush from 'web-push'

export interface PushPayload {
  title: string
  body: string
  url?: string
}

let vapidReady = false
function ensureVapid(): boolean {
  if (vapidReady) return true
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:no-reply@anonindia.com', pub, priv)
  vapidReady = true
  return true
}

/** Send to Expo push tokens. Returns endpoints that are no longer valid. */
export async function sendExpoPush(tokens: string[], payload: PushPayload): Promise<string[]> {
  if (tokens.length === 0) return []
  const messages = tokens.map((to) => ({
    to,
    title: payload.title,
    body: payload.body,
    data: payload.url ? { url: payload.url } : {},
    sound: 'default',
  }))

  const dead: string[] = []
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(messages),
    })
    const json: any = await res.json().catch(() => ({}))
    const data = json?.data ?? []
    data.forEach((ticket: any, i: number) => {
      if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
        dead.push(tokens[i])
      }
    })
  } catch (e) {
    console.error('[push] expo send failed:', e)
  }
  return dead
}

/** Send to a Web Push subscription. Returns true if the subscription is dead (410/404). */
export async function sendWebPush(subscription: any, payload: PushPayload): Promise<{ dead: boolean }> {
  if (!ensureVapid()) return { dead: false }
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return { dead: false }
  } catch (e: any) {
    const code = e?.statusCode
    if (code === 404 || code === 410) return { dead: true }
    console.error('[push] web-push send failed:', e?.message ?? e)
    return { dead: false }
  }
}
