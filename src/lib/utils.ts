import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format, isAfter, isBefore, addHours, parseISO } from 'date-fns'
import type { Lead, SlaStatus } from '@/types/leads'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(
  amount: number | null | undefined,
  opts: { precision?: 1 | 2; mode?: 'compact' | 'exact' } = {},
): string {
  if (amount == null) return '—'
  const { precision = 1, mode = 'compact' } = opts
  if (mode === 'exact') return `₹${amount.toLocaleString('en-IN')}`
  // Round first, then pick the unit: 99,99,999 used to print as "₹100.0L" and 9,99,999 as "₹1000K".
  const cr = Number((amount / 10000000).toFixed(precision))
  if (cr >= 1) return `₹${cr.toFixed(precision)}Cr`
  const lakh = Number((amount / 100000).toFixed(precision))
  if (lakh >= 1) return lakh >= 100 ? `₹${(1).toFixed(precision)}Cr` : `₹${lakh.toFixed(precision)}L`
  const k = Math.round(amount / 1000)
  if (k >= 1000) return `₹${(1).toFixed(precision)}L`
  if (amount >= 1000) return `₹${k}K`
  return `₹${amount.toLocaleString('en-IN')}`
}

// Timestamps are shown in IST wherever the code runs. date-fns `format` uses the machine's zone:
// the server (UTC) and the browser (IST) rendered different text for the same instant, so pages
// showed "1:02 AM" for something the timeline showed as "6:32 AM" and React logged hydration error #418.
const IST = 'Asia/Kolkata'
const isDateOnly = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

function istParts(d: Date, withTime: boolean) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST, day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit', hour12: true } : {}),
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const date = `${get('day')} ${get('month')} ${get('year')}`
  return withTime ? `${date}, ${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}` : date
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    // A bare date (a booking date, a DOB) has no time to convert.
    if (isDateOnly(dateStr)) return format(parseISO(dateStr), 'dd MMM yyyy')
    const d = new Date(dateStr)
    return Number.isNaN(d.getTime()) ? '—' : istParts(d, false)
  } catch {
    return '—'
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = isDateOnly(dateStr) ? parseISO(dateStr) : new Date(dateStr)
    return Number.isNaN(d.getTime()) ? '—' : istParts(d, true)
  } catch {
    return '—'
  }
}

export function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true })
  } catch {
    return '—'
  }
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  let digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
  }
  return phone
}

export function formatBudgetRange(min: number | null, max: number | null): string {
  if (!min && !max) return '—'
  if (min && max) return `${formatCurrency(min)} – ${formatCurrency(max)}`
  if (min) return `From ${formatCurrency(min)}`
  return `Up to ${formatCurrency(max)}`
}

export function computeSlaStatus(lead: Lead): { status: SlaStatus; hoursRemaining: number | null } {
  const slaWindowHours: Record<string, number | null> = {
    new_lead: 2,
    contacted: 24,
    interested: 48,
    site_visit_done: 24,
  }

  const window = slaWindowHours[lead.stage]
  if (window == null) return { status: 'on_time', hoursRemaining: null }

  // The clock starts when the lead ENTERED this stage. From creation, any lead older than a day
  // sat in "breached" for every stage that has a window.
  const startedAt = parseISO(lead.stage_changed_at ?? lead.created_at)
  const deadline = addHours(startedAt, window)
  const now = new Date()

  if (isAfter(now, deadline)) {
    return { status: 'breached', hoursRemaining: 0 }
  }

  const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)

  if (hoursRemaining < window * 0.25) {
    return { status: 'at_risk', hoursRemaining: Math.round(hoursRemaining * 10) / 10 }
  }

  return { status: 'on_time', hoursRemaining: Math.round(hoursRemaining * 10) / 10 }
}

export function isFollowUpOverdue(lead: Lead): boolean {
  if (!lead.next_followup_at) return false
  return isBefore(parseISO(lead.next_followup_at), new Date())
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function suggestNextFollowup(outcome: string): Date {
  const now = new Date()
  switch (outcome) {
    case 'not_reachable':
      return addHours(now, 4)
    case 'callback_requested':
      return addHours(now, 2)
    case 'connected_interested':
      return addHours(now, 24)
    default:
      return addHours(now, 24)
  }
}
