/**
 * Date-time inputs (`<input type="datetime-local">`) send a bare "2026-10-20T19:56" with no zone.
 * Saved as-is, Postgres reads it as UTC, so a follow-up the user set for 7:56 PM IST was stored as
 * 7:56 PM UTC (1:26 AM IST the next day) — every follow-up and site visit was 5½ hours late.
 * The CRM works in India, so a zone-less value is Indian Standard Time.
 */
const IST_OFFSET_MIN = 330

/** Converts a form date-time to an ISO instant. Values that already carry a zone, and date-only values, pass through. */
export function istToIso(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.trim()
  if (!v) return null
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(v)) return v          // already has a zone
  if (!v.includes('T') && !/\d:\d/.test(v)) return v          // a plain date
  const m = v.replace(' ', 'T').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return v
  const [, y, mo, d, h, mi, s] = m
  const utc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0)) - IST_OFFSET_MIN * 60_000
  return new Date(utc).toISOString()
}

const IST_OFFSET_MS = IST_OFFSET_MIN * 60_000
const DAY_MS = 86_400_000

/**
 * Today's calendar date in India as "YYYY-MM-DD". `new Date().toISOString().split('T')[0]` is the
 * UTC date, which is still yesterday between 00:00 and 05:30 IST.
 */
export function todayIST(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** The instant IST midnight began for the day containing `now`, shifted by `days` (negative = earlier). */
export function istDayStart(now: Date = new Date(), days = 0): Date {
  const shifted = now.getTime() + IST_OFFSET_MS
  return new Date(shifted - (shifted % DAY_MS) - IST_OFFSET_MS + days * DAY_MS)
}

/** [start, end) of the IST calendar day containing `now`, as instants. */
export function istDayBounds(now: Date = new Date()): { start: Date; end: Date } {
  const start = istDayStart(now)
  return { start, end: new Date(start.getTime() + DAY_MS) }
}

/** IST midnight of the Sunday that starts the current week. */
export function istWeekStart(now: Date = new Date()): Date {
  const weekday = new Date(now.getTime() + IST_OFFSET_MS).getUTCDay() // 0 = Sunday, in IST
  return istDayStart(now, -weekday)
}

/** Formats an instant in IST, regardless of where the code runs (server renders UTC, browsers local). */
export function formatInIST(value: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', ...opts }).format(d)
}
