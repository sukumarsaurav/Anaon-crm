import type { IncentiveSlab, CommissionResult } from '@/types/team'

export function calculateCommission(
  bookings: number,
  revenueTotal: number,
  slabs: IncentiveSlab[]
): CommissionResult {
  const active = slabs
    .filter((s) => s.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)

  // Find which slab the advisor currently sits in
  const currentSlab = active.findLast(
    (s) => bookings >= s.from_bookings && (s.to_bookings === null || bookings <= s.to_bookings)
  ) ?? null

  // Find next tier up
  const nextSlab = currentSlab
    ? active.find((s) => s.from_bookings > (currentSlab.to_bookings ?? Infinity)) ?? null
    : active[0] ?? null

  const commissionAmount = currentSlab
    ? (revenueTotal * currentSlab.commission_percent) / 100
    : 0

  const bonusAmount = currentSlab?.bonus_amount ?? 0

  const bookingsToNext =
    nextSlab && currentSlab
      ? nextSlab.from_bookings - bookings
      : nextSlab
      ? nextSlab.from_bookings - bookings
      : null

  return {
    current_slab: currentSlab,
    next_slab: nextSlab,
    commission_amount: commissionAmount,
    bonus_amount: bonusAmount,
    bookings_to_next: bookingsToNext,
  }
}

export function calculateAchievementPct(actual: number, target: number): number {
  if (target === 0) return actual > 0 ? 100 : 0
  return Math.min(Math.round((actual / target) * 100), 999)
}

export function isAtRisk(achievementPct: number): boolean {
  const today = new Date()
  const dayOfMonth = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const monthProgress = dayOfMonth / daysInMonth
  // At risk if past mid-month and under 50%
  return monthProgress >= 0.5 && achievementPct < 50
}

export interface SlabDraft {
  id?: string
  label: string
  from_bookings: number
  to_bookings: number | null
  commission_percent: number
  bonus_amount: number
  is_active: boolean
}

/**
 * The active slabs must cover every booking count exactly once: start at 0, no gaps or overlaps,
 * and one open-ended top slab. Otherwise someone with N bookings could match no slab (and earn
 * nothing) or two. Returns the first problem, or null.
 */
export function slabProblem(slabs: SlabDraft[]): string | null {
  for (const s of slabs) {
    if (!s.label.trim()) return 'Every slab needs a name'
    if (!Number.isInteger(s.from_bookings) || s.from_bookings < 0) return `${s.label}: "from" must be a whole number ≥ 0`
    if (s.to_bookings != null && (!Number.isInteger(s.to_bookings) || s.to_bookings < s.from_bookings)) return `${s.label}: "to" must be ≥ "from"`
    if (!(s.commission_percent >= 0 && s.commission_percent <= 10)) return `${s.label}: commission must be 0–10%`
    if (!(s.bonus_amount >= 0)) return `${s.label}: bonus can't be negative`
  }
  const active = slabs.filter((s) => s.is_active).sort((a, b) => a.from_bookings - b.from_bookings)
  if (!active.length) return 'Keep at least one slab active'
  if (active[0].from_bookings !== 0) return 'The first active slab must start at 0 bookings'
  for (let i = 0; i < active.length; i++) {
    const s = active[i], next = active[i + 1]
    if (!next) {
      if (s.to_bookings != null) return `The top slab (${s.label}) must be open-ended — leave "to" empty`
      break
    }
    if (s.to_bookings == null) return `Only the top slab can be open-ended (${s.label} isn't the top)`
    if (next.from_bookings !== s.to_bookings + 1) {
      return next.from_bookings <= s.to_bookings
        ? `${s.label} and ${next.label} overlap`
        : `Gap between ${s.label} (to ${s.to_bookings}) and ${next.label} (from ${next.from_bookings})`
    }
  }
  return null
}
