/**
 * The number to hand WhatsApp, as digits with country code (91XXXXXXXXXX).
 *
 * Leads are stored as bare 10-digit Indian mobiles (ingest.ts normalizes them that way)
 * or as typed ("+91-98100 01025"). WhatsApp and AgencyX read a bare 10-digit number as
 * already carrying a country code, so "9812345678" would go to +98 (Iran) — every
 * Indian 10-digit number has to get its 91 here, before any send.
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 10) return `91${digits}`
  if (digits.length >= 11 && digits.length <= 15) return digits
  return null
}

/** The last 10 digits — how a WhatsApp number is matched against a lead's phone. */
export function lastTenDigits(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : null
}
