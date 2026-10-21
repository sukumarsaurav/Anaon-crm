/**
 * RERA date rules. Plain module.
 *
 * Quarterly progress updates are due a fixed number of days after each calendar quarter ends.
 * "Today + 3 months" drifted later every time a report was filed late. The grace period varies by
 * state authority — confirm it with your RERA consultant.
 */
export const QUARTERLY_GRACE_DAYS = 15

/** Due date ("YYYY-MM-DD") of the report for the quarter that contains `today`. */
export function nextQuarterlyDue(today: string): string {
  const [y, m] = today.split('-').map(Number)
  const quarterEndMonth = Math.ceil(m / 3) * 3 // 3, 6, 9, 12
  const quarterEnd = Date.UTC(y, quarterEndMonth, 0) // last day of that month
  return new Date(quarterEnd + QUARTERLY_GRACE_DAYS * 86_400_000).toISOString().slice(0, 10)
}

/** True when the registration has an expiry date on or before `today`. */
export function reraExpired(expiry: string | null | undefined, today: string): boolean {
  return !!expiry && expiry < today
}
