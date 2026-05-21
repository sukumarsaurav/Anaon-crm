import type { AutoReplyRule } from '@/types/whatsapp'
import { sendTextMessage, sendInteractiveButtons } from './provider'

const OFFICE_START_HOUR = 9   // 9 AM IST
const OFFICE_END_HOUR = 19    // 7 PM IST

export function isOfficeHours(): boolean {
  const now = new Date()
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000
  const ist = new Date(now.getTime() + istOffset)
  const hour = ist.getUTCHours()
  const day = ist.getUTCDay() // 0=Sun, 6=Sat
  if (day === 0) return false // closed Sunday
  return hour >= OFFICE_START_HOUR && hour < OFFICE_END_HOUR
}

export function matchesKeywords(
  message: string,
  keywords: string[],
  matchMode: 'any' | 'all' = 'any'
): boolean {
  const lower = message.toLowerCase()
  if (matchMode === 'any') {
    return keywords.some((k) => lower.includes(k.toLowerCase()))
  }
  return keywords.every((k) => lower.includes(k.toLowerCase()))
}

export interface AutoReplyResult {
  matched: boolean
  ruleName?: string
  sent?: boolean
}

export async function runAutoReplyRules(
  phone: string,
  message: string,
  isNewContact: boolean,
  rules: AutoReplyRule[]
): Promise<AutoReplyResult> {
  // Sort by priority (lower number = higher priority)
  const sorted = [...rules].filter((r) => r.is_active).sort((a, b) => a.priority - b.priority)

  for (const rule of sorted) {
    let triggered = false

    switch (rule.trigger_type) {
      case 'office_hours': {
        const config = rule.trigger_config as { trigger_when?: string }
        const outside = config.trigger_when === 'outside'
        triggered = outside ? !isOfficeHours() : isOfficeHours()
        break
      }
      case 'new_contact': {
        triggered = isNewContact
        break
      }
      case 'keyword': {
        const config = rule.trigger_config as { keywords?: string[]; match?: 'any' | 'all' }
        if (config.keywords?.length) {
          triggered = matchesKeywords(message, config.keywords, config.match ?? 'any')
        }
        break
      }
    }

    if (!triggered) continue

    // Send the response
    if (rule.response_type === 'text' && rule.response_text) {
      await sendTextMessage(phone, rule.response_text)
    } else if (rule.response_type === 'interactive' && rule.response_buttons?.length) {
      await sendInteractiveButtons(
        phone,
        rule.response_text ?? 'How can we help you?',
        [
          { id: 'see_projects', title: '🏡 See Projects' },
          { id: 'talk_advisor', title: '👤 Talk to Advisor' },
          { id: 'schedule_visit', title: '📅 Schedule Visit' },
        ]
      )
    }

    return { matched: true, ruleName: rule.name, sent: true }
  }

  return { matched: false }
}
