/**
 * OTP delivery rail.
 *
 * Primary channel = WhatsApp (Meta Cloud API, already wired in lib/whatsapp).
 * Fallback channel = SMS (MSG91). Returns success if *either* channel accepts
 * the message. The OTP itself is never returned to the caller — delivery only.
 *
 * Env vars:
 *   WHATSAPP_OTP_TEMPLATE_NAME — approved WhatsApp template whose body has one
 *                                {{1}} variable for the OTP code (default 'otp_login')
 */

import { sendTemplateMessage } from '@/lib/whatsapp/provider'
import { sendSms, toMsg91Mobile } from './sms'

const WHATSAPP_OTP_TEMPLATE = process.env.WHATSAPP_OTP_TEMPLATE_NAME ?? 'otp_login'

export interface DeliverOtpResult {
  success: boolean
  channel?: 'whatsapp' | 'sms'
  error?: string
}

/**
 * Deliver a 6-digit OTP to an Indian mobile number.
 * Tries WhatsApp first, falls back to SMS. The `phone` may be 10-digit or
 * include a country code — it is normalized per channel.
 */
export async function deliverOtp(phone: string, otp: string): Promise<DeliverOtpResult> {
  const waTo = toMsg91Mobile(phone) // 91XXXXXXXXXX, also valid for WhatsApp `to`

  // 1. WhatsApp template (primary)
  const wa = await sendTemplateMessage(waTo, WHATSAPP_OTP_TEMPLATE, 'en', [otp])
  if (wa.success) return { success: true, channel: 'whatsapp' }

  // 2. SMS fallback
  const sms = await sendSms(phone, { OTP: otp })
  if (sms.success) return { success: true, channel: 'sms' }

  return { success: false, error: sms.error ?? wa.error ?? 'All OTP channels failed' }
}
