/**
 * Builds the value for a PostgREST `.or()` text search across several columns.
 *
 * The search box used to be pasted straight into `col.ilike.%term%,…`. PostgREST splits that string
 * on commas and parentheses, so "Sharma, Rahul" made the query fail and the list just showed
 * "no leads". Each value is double-quoted here, which PostgREST reads as a literal.
 *
 * Phone columns are matched on digits only: stored phones look like "9876543210" or "+91-98765…",
 * so "98765 43210" or "+91 98765 43210" would otherwise never match.
 */
export function searchOr(
  term: string | null | undefined,
  cols: { text: string[]; phone?: string[] },
): string | null {
  const q = (term ?? '').trim().replace(/\s+/g, ' ')
  if (!q) return null

  const quote = (v: string) => `"%${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}%"`
  const parts = cols.text.map((c) => `${c}.ilike.${quote(q)}`)

  if (cols.phone?.length) {
    let digits = q.replace(/\D/g, '')
    // Drop a typed country code / trunk zero so the rest matches either stored format.
    if (digits.length > 10) digits = digits.slice(-10)
    const phoneLike = /^[\d\s+()-]+$/.test(q)
    const phoneTerm = phoneLike && digits.length >= 3 ? digits : q
    for (const c of cols.phone) parts.push(`${c}.ilike.${quote(phoneTerm)}`)
  }

  return parts.join(',')
}
