import type { ChatbotSession, ChatbotState, ChatbotContext } from '@/types/whatsapp'
import { sendTextMessage, sendInteractiveButtons } from './provider'

const MAX_BOT_TURNS = 5

interface BotResponse {
  nextState: ChatbotState
  context: ChatbotContext
  handoff: boolean
  handoffReason?: string
}

const CITY_BUTTONS = [
  { id: 'city_jaipur', title: 'Jaipur' },
  { id: 'city_delhi', title: 'Delhi NCR' },
  { id: 'city_other', title: 'Other City' },
]

const BUDGET_BUTTONS = [
  { id: 'budget_under_20l', title: 'Under ₹20L' },
  { id: 'budget_20_40l', title: '₹20L–₹40L' },
  { id: 'budget_40_60l', title: '₹40L–₹60L' },
  { id: 'budget_above_60l', title: 'Above ₹60L' },
]

function parseSelection(text: string, validIds: string[]): string | null {
  const lower = text.toLowerCase().trim()
  // Match by ID
  if (validIds.includes(lower)) return lower
  // Match by number (1,2,3,4)
  const num = parseInt(lower, 10)
  if (!isNaN(num) && num >= 1 && num <= validIds.length) return validIds[num - 1]
  return null
}

export async function processBotMessage(
  phone: string,
  incomingText: string,
  session: ChatbotSession,
  projectList: Array<{ name: string; city: string; type: string }>
): Promise<BotResponse> {
  const { state, context, turn_count } = session
  let nextState: ChatbotState = state
  let nextContext = { ...context }

  // Force handoff after max turns
  if (turn_count >= MAX_BOT_TURNS) {
    await sendTextMessage(
      phone,
      'Connecting you with one of our advisors now. They will reach out to you shortly! 👤'
    )
    return { nextState: 'done', context: nextContext, handoff: true, handoffReason: 'max_turns' }
  }

  switch (state) {
    case 'greeting':
    case 'menu': {
      await sendInteractiveButtons(
        phone,
        'Hi! Welcome to ANON INDIA 🏡\nHow can we help you today?',
        [
          { id: 'menu_projects', title: '🏘 View Projects' },
          { id: 'menu_visit', title: '📅 Schedule Visit' },
          { id: 'menu_advisor', title: '👤 Talk to Advisor' },
        ],
        'ANON INDIA',
        'Real Estate Developers'
      )
      nextState = 'menu'
      break
    }

    case 'menu': {
      const sel = parseSelection(incomingText, ['menu_projects', 'menu_visit', 'menu_advisor'])
      const lower = incomingText.toLowerCase()

      if (sel === 'menu_projects' || lower.includes('project') || lower.includes('view') || lower === '1') {
        await sendInteractiveButtons(phone, 'Which city are you looking in?', CITY_BUTTONS)
        nextState = 'projects__ask_city'
      } else if (sel === 'menu_visit' || lower.includes('visit') || lower === '2') {
        await sendTextMessage(phone, 'We\'d love to show you our properties! 🏡\nPlease share your preferred date for the visit (e.g. "25th May" or "this Saturday").')
        nextState = 'schedule_visit__ask_date'
      } else if (sel === 'menu_advisor' || lower.includes('advisor') || lower === '3') {
        await sendTextMessage(phone, 'Connecting you with one of our advisors now. They will reach out to you shortly! 👤')
        return { nextState: 'talk_to_advisor', context: nextContext, handoff: true, handoffReason: 'user_requested' }
      } else {
        await sendTextMessage(phone, 'Please choose an option by replying with a number:\n1. View Projects\n2. Schedule Visit\n3. Talk to Advisor')
      }
      break
    }

    case 'projects__ask_city': {
      const cityMap: Record<string, string> = {
        city_jaipur: 'Jaipur',
        city_delhi: 'Delhi NCR',
        city_other: 'Your City',
      }
      const sel = parseSelection(incomingText, Object.keys(cityMap))
      const city = sel ? cityMap[sel] : incomingText.trim()
      nextContext.city = city

      await sendInteractiveButtons(phone, `Great! What is your budget for a property in ${city}?`, BUDGET_BUTTONS)
      nextState = 'projects__ask_budget'
      break
    }

    case 'projects__ask_budget': {
      const budgetMap: Record<string, string> = {
        budget_under_20l: 'Under ₹20L',
        budget_20_40l: '₹20L–₹40L',
        budget_40_60l: '₹40L–₹60L',
        budget_above_60l: 'Above ₹60L',
      }
      const sel = parseSelection(incomingText, Object.keys(budgetMap))
      const budget = sel ? budgetMap[sel] : incomingText.trim()
      nextContext.budget_range = budget

      // Filter projects by city (simple match)
      const cityProjects = projectList.filter(
        (p) => !nextContext.city || p.city.toLowerCase().includes((nextContext.city ?? '').toLowerCase())
      )

      if (cityProjects.length === 0) {
        await sendTextMessage(
          phone,
          `We don't have active projects in ${nextContext.city} matching your budget right now, but our advisor can suggest the best options!\n\nConnecting you now... 👤`
        )
        return { nextState: 'talk_to_advisor', context: nextContext, handoff: true, handoffReason: 'no_projects' }
      }

      const projectLines = cityProjects
        .slice(0, 3)
        .map((p, i) => `${i + 1}. *${p.name}* — ${p.city} (${p.type.replace('_', ' ')})`)
        .join('\n')

      await sendTextMessage(
        phone,
        `Here are our projects in ${nextContext.city} within your budget:\n\n${projectLines}\n\nWould you like to schedule a site visit? Reply *Yes* to book or *Advisor* to speak with our team.`
      )
      nextState = 'projects__show_results'
      break
    }

    case 'projects__show_results': {
      const lower = incomingText.toLowerCase()
      if (lower.includes('yes') || lower.includes('visit') || lower === '1') {
        await sendTextMessage(phone, 'Wonderful! 🎉\nPlease share your preferred date for the site visit (e.g. "25th May afternoon").')
        nextState = 'schedule_visit__ask_date'
      } else if (lower.includes('advisor') || lower.includes('call') || lower === '2') {
        await sendTextMessage(phone, 'Our advisor will call you shortly! 👤')
        return { nextState: 'talk_to_advisor', context: nextContext, handoff: true, handoffReason: 'user_requested' }
      } else {
        await sendTextMessage(phone, 'Please reply *Yes* to schedule a visit or *Advisor* to speak with our team.')
      }
      break
    }

    case 'schedule_visit__ask_date': {
      nextContext.preferred_date = incomingText.trim()
      await sendTextMessage(
        phone,
        `Perfect! We've noted your preferred date: *${incomingText.trim()}*.\n\nOur advisor will confirm the exact time and send you the details. See you soon! 🏡`
      )
      return { nextState: 'done', context: nextContext, handoff: true, handoffReason: 'visit_requested' }
    }

    default: {
      await sendTextMessage(phone, 'Connecting you with our team now. 👤')
      return { nextState: 'done', context: nextContext, handoff: true, handoffReason: 'unknown_state' }
    }
  }

  return { nextState, context: nextContext, handoff: false }
}
