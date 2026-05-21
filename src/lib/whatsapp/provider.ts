/**
 * WhatsApp provider abstraction.
 * Implements Meta Cloud API directly — compatible with Interakt, Wati, AiSensy
 * (all use Meta's webhook format + Cloud API under the hood).
 *
 * Set env vars:
 *   WHATSAPP_ACCESS_TOKEN       — permanent access token from Meta App
 *   WHATSAPP_PHONE_NUMBER_ID    — phone number ID from Meta Business Manager
 *   WHATSAPP_WEBHOOK_VERIFY_TOKEN — your custom verify token for webhook validation
 *   WHATSAPP_API_VERSION        — defaults to v19.0
 */

const BASE_URL = 'https://graph.facebook.com'
const API_VERSION = process.env.WHATSAPP_API_VERSION ?? 'v19.0'
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN ?? ''
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''

export interface SendTextResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface SendTemplateResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface InteractiveButton {
  id: string
  title: string
}

function apiUrl(path: string) {
  return `${BASE_URL}/${API_VERSION}/${path}`
}

async function callApi<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    console.warn('[WhatsApp] Provider not configured — missing env vars')
    return { data: null, error: 'WhatsApp not configured' }
  }

  try {
    const res = await fetch(apiUrl(endpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(body),
    })

    const json = await res.json()
    if (!res.ok) {
      const msg = json?.error?.message ?? `HTTP ${res.status}`
      return { data: null, error: msg }
    }
    return { data: json as T, error: null }
  } catch (err) {
    return { data: null, error: String(err) }
  }
}

export async function sendTextMessage(to: string, text: string): Promise<SendTextResult> {
  const { data, error } = await callApi<{ messages: Array<{ id: string }> }>(
    `${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text },
    }
  )
  if (error || !data) return { success: false, error: error ?? 'Unknown error' }
  return { success: true, messageId: data.messages?.[0]?.id }
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string = 'en',
  variables: string[]
): Promise<SendTemplateResult> {
  const components: Record<string, unknown>[] = []

  if (variables.length > 0) {
    components.push({
      type: 'body',
      parameters: variables.map((v) => ({ type: 'text', text: v })),
    })
  }

  const { data, error } = await callApi<{ messages: Array<{ id: string }> }>(
    `${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    }
  )
  if (error || !data) return { success: false, error: error ?? 'Unknown error' }
  return { success: true, messageId: data.messages?.[0]?.id }
}

export async function sendInteractiveButtons(
  to: string,
  body: string,
  buttons: InteractiveButton[],
  header?: string,
  footer?: string
): Promise<SendTextResult> {
  const { data, error } = await callApi<{ messages: Array<{ id: string }> }>(
    `${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        ...(header ? { header: { type: 'text', text: header } } : {}),
        body: { text: body },
        ...(footer ? { footer: { text: footer } } : {}),
        action: {
          buttons: buttons.map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    }
  )
  if (error || !data) return { success: false, error: error ?? 'Unknown error' }
  return { success: true, messageId: data.messages?.[0]?.id }
}

export async function markMessageRead(messageId: string): Promise<void> {
  await callApi(`${PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  })
}

export function verifyWebhookSignature(
  signature: string,
  body: string,
  appSecret: string
): boolean {
  if (!appSecret) return true // skip in dev if not configured
  const crypto = require('crypto')
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(body).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

export function renderTemplate(
  body: string,
  variableNames: string[],
  values: Record<string, string>
): string {
  let rendered = body
  variableNames.forEach((name, i) => {
    const placeholder = `{{${i + 1}}}`
    rendered = rendered.replaceAll(placeholder, values[name] ?? `[${name}]`)
  })
  return rendered
}
