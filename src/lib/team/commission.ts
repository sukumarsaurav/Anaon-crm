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
