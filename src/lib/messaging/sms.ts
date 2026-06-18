/**
 * SMS provider — MSG91 (India, DLT-compliant).
 *
 * Uses the MSG91 Flow API so we send our *own* generated OTP via an approved
 * DLT template (rather than MSG91's self-generated OTP endpoint). The template
 * must expose a single variable `##OTP##` mapped to `var` below.
 *
 * Env vars:
 *   MSG91_AUTH_KEY        — MSG91 auth key
 *   MSG91_OTP_TEMPLATE_ID — Flow/DLT template id for OTP messages
 *   MSG91_SENDER_ID       — optional 6-char DLT sender id
 */

const FLOW_URL = 'https://control.msg91.com/api/v5/flow/'

export interface SmsResult {
  success: boolean
  error?: string
}

/** Normalize an Indian number to MSG91 format: 91XXXXXXXXXX (no +). */
export function toMsg91Mobile(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  return digits
}

/**
 * Send a transactional SMS through a MSG91 Flow template.
 * `variables` keys must match the template's variable names (e.g. { OTP: '123456' }).
 */
export async function sendSms(
  phone: string,
  variables: Record<string, string>,
  templateId = process.env.MSG91_OTP_TEMPLATE_ID,
): Promise<SmsResult> {
  const authKey = process.env.MSG91_AUTH_KEY
  if (!authKey || !templateId) {
    console.warn('[SMS] MSG91 not configured — missing MSG91_AUTH_KEY / template id')
    return { success: false, error: 'SMS not configured' }
  }

  try {
    const res = await fetch(FLOW_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: authKey,
      },
      body: JSON.stringify({
        template_id: templateId,
        ...(process.env.MSG91_SENDER_ID ? { sender: process.env.MSG91_SENDER_ID } : {}),
        recipients: [{ mobiles: toMsg91Mobile(phone), ...variables }],
      }),
    })

    const json = await res.json().catch(() => ({}))
    // MSG91 returns { type: 'success' | 'error', message }
    if (!res.ok || json?.type === 'error') {
      return { success: false, error: json?.message ?? `HTTP ${res.status}` }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
