/**
 * Transactional email via Resend.
 *
 * Env vars:
 *   RESEND_API_KEY — Resend API key
 *   EMAIL_FROM     — verified sender, e.g. "ANON INDIA <no-reply@anonindia.com>"
 */

import { Resend } from 'resend'

export interface EmailAttachment {
  filename: string
  content: Buffer
}

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html: string
  attachments?: EmailAttachment[]
  replyTo?: string
}

export interface SendEmailResult {
  success: boolean
  id?: string
  error?: string
}

export function emailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

let _client: Resend | null = null
function client(): Resend {
  if (!_client) _client = new Resend(process.env.RESEND_API_KEY!)
  return _client
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!emailConfigured()) {
    console.warn('[email] Resend not configured — skipping send')
    return { success: false, error: 'Email not configured' }
  }

  try {
    const { data, error } = await client().emails.send({
      from: process.env.EMAIL_FROM!,
      to: input.to,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
      attachments: input.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
    })
    if (error) return { success: false, error: error.message }
    return { success: true, id: data?.id }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
