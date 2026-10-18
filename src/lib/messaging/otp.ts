/**
 * OTP delivery rail.
 *
 * Primary channel = WhatsApp (AgencyX when configured, else Meta Cloud API — lib/whatsapp/send).
 * Fallback channel = SMS (MSG91). Returns success if *either* channel accepts
 * the message. The OTP itself is never returned to the caller — delivery only.
 *
 * Env vars:
 *   WHATSAPP_OTP_TEMPLATE_NAME — approved WhatsApp template whose body has one
 *                                {{1}} variable for the OTP code (default 'otp_login')
 */

import { sendWhatsAppTemplate } from '@/lib/whatsapp/send'
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
  // 1. WhatsApp template (primary)
  const wa = await sendWhatsAppTemplate({ to: toMsg91Mobile(phone), name: WHATSAPP_OTP_TEMPLATE, language: 'en', variables: [otp], category: 'authentication' })
  if (wa.success) return { success: true, channel: 'whatsapp' }

  // 2. SMS fallback
  const sms = await sendSms(phone, { OTP: otp })
  if (sms.success) return { success: true, channel: 'sms' }

  return { success: false, error: sms.error ?? wa.error ?? 'All OTP channels failed' }
}
