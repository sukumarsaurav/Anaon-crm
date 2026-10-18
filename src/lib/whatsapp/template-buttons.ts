import type { WaTemplateButton } from '@/types/whatsapp'

/**
 * Checks template buttons against WhatsApp's rules (AgencyX Integration Overview §4.9).
 * Only fixed buttons are offered in the CRM: a URL ending in {{1}} or a coupon button
 * needs a value on every send, which nothing here supplies.
 * Shared by the form (client) and createTemplate (server).
 */
export function validateTemplateButtons(buttons: WaTemplateButton[]): string | null {
  if (buttons.length > 10) return 'At most 10 buttons'
  if (buttons.filter((b) => b.type === 'URL').length > 2) return 'At most 2 website buttons'
  if (buttons.filter((b) => b.type === 'PHONE_NUMBER').length > 1) return 'At most 1 call button'
  for (const b of buttons) {
    const text = b.text?.trim() ?? ''
    if (!text) return 'Every button needs a label'
    if (text.length > 25) return `Button "${text}" — labels are limited to 25 characters`
    if (b.type === 'URL') {
      if (!/^https:\/\/\S+$/.test(b.url ?? '')) return `Button "${text}" needs a full https:// link`
      if (b.url!.includes('{{')) return `Button "${text}": links with variables aren't supported here — use a fixed link`
    } else if (b.type === 'PHONE_NUMBER') {
      if (!/^\+\d{8,15}$/.test((b.phone_number ?? '').replace(/[\s-]/g, ''))) {
        return `Button "${text}" needs a phone number with country code, e.g. +919876543210`
      }
    } else if (b.type !== 'QUICK_REPLY') {
      return `Button type ${b.type} isn't supported here`
    }
  }
  return null
}

/** Trims and keeps only the fields each button type uses. */
export function normalizeTemplateButtons(buttons: WaTemplateButton[]): WaTemplateButton[] {
  return buttons.map((b) => {
    const text = b.text.trim()
    if (b.type === 'URL') return { type: 'URL', text, url: b.url!.trim() }
    if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text, phone_number: b.phone_number!.replace(/[\s-]/g, '') }
    return { type: 'QUICK_REPLY', text }
  })
}
