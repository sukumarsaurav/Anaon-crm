/**
 * Click-to-call via Exotel (India telephony). Provider-agnostic surface — swap
 * the body of `initiateCall` to support Servetel/Knowlarity without touching callers.
 *
 * Exotel "Connect two numbers": rings the agent first, then dials the customer,
 * and (if enabled on the ExoPhone) records the call. Status + recording arrive
 * later on the status-callback webhook.
 *
 * Env vars:
 *   EXOTEL_SID        — account SID
 *   EXOTEL_API_KEY    — API key
 *   EXOTEL_API_TOKEN  — API token
 *   EXOTEL_CALLER_ID  — your ExoPhone (CallerId)
 *   EXOTEL_SUBDOMAIN  — api.exotel.com (default) or api.in.exotel.com
 */

export interface InitiateCallResult {
  success: boolean
  callSid?: string
  error?: string
}

export function exotelConfigured(): boolean {
  return !!(
    process.env.EXOTEL_SID &&
    process.env.EXOTEL_API_KEY &&
    process.env.EXOTEL_API_TOKEN &&
    process.env.EXOTEL_CALLER_ID
  )
}

/** Normalize an Indian number to E.164 (+91XXXXXXXXXX). */
export function toE164(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length === 10) return `+91${d}`
  if (d.length === 12 && d.startsWith('91')) return `+${d}`
  if (phone.startsWith('+')) return phone
  return `+${d}`
}

export async function initiateCall(
  agentPhone: string,
  customerPhone: string,
  statusCallbackUrl?: string,
): Promise<InitiateCallResult> {
  if (!exotelConfigured()) return { success: false, error: 'Telephony not configured' }

  const sid = process.env.EXOTEL_SID!
  const key = process.env.EXOTEL_API_KEY!
  const token = process.env.EXOTEL_API_TOKEN!
  const subdomain = process.env.EXOTEL_SUBDOMAIN ?? 'api.exotel.com'
  const auth = Buffer.from(`${key}:${token}`).toString('base64')

  const form = new URLSearchParams({
    From: toE164(agentPhone),
    To: toE164(customerPhone),
    CallerId: process.env.EXOTEL_CALLER_ID!,
    Record: 'true',
    ...(statusCallbackUrl ? { StatusCallback: statusCallbackUrl } : {}),
  })

  try {
    const res = await fetch(`https://${subdomain}/v1/Accounts/${sid}/Calls/connect.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) return { success: false, error: json?.RestException?.Message ?? `HTTP ${res.status}` }
    return { success: true, callSid: json?.Call?.Sid }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
