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
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(precision)}Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(precision)}L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`
  return `₹${amount.toLocaleString('en-IN')}`
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy')
  } catch {
    return '—'
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy, h:mm a')
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
  const digits = phone.replace(/\D/g, '')
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

  const createdAt = parseISO(lead.created_at)
  const deadline = addHours(createdAt, window)
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
