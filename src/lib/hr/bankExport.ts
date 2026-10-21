/**
 * Salary transfer file for the bank's bulk-upload. Plain module. Each bank format is a column map; add
 * the one your bank uses next to `generic`.
 */
export interface BankRow {
  name: string
  account: string | null
  ifsc: string | null
  amount: number
  email: string | null
  employeeId: string | null
}

export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/

type Column = { header: string; value: (r: BankRow, narration: string) => string | number }

export const BANK_FORMATS: Record<string, { label: string; columns: Column[] }> = {
  generic: {
    label: 'Generic CSV',
    columns: [
      { header: 'Beneficiary Name', value: (r) => r.name },
      { header: 'Account Number', value: (r) => r.account ?? '' },
      { header: 'IFSC', value: (r) => r.ifsc ?? '' },
      { header: 'Amount', value: (r) => r.amount.toFixed(2) },
      { header: 'Narration', value: (r, n) => `${n} ${r.employeeId ?? ''}`.trim() },
      { header: 'Email', value: (r) => r.email ?? '' },
    ],
  },
}

/** Rows that can be paid, and the ones held back with the reason. */
export function splitPayable(rows: BankRow[]): { ok: BankRow[]; missing: { name: string; reason: string; amount: number }[] } {
  const ok: BankRow[] = []
  const missing: { name: string; reason: string; amount: number }[] = []
  for (const r of rows) {
    if (r.amount <= 0) continue
    const account = r.account?.replace(/\s/g, '') ?? ''
    const ifsc = r.ifsc?.trim().toUpperCase() ?? ''
    if (!/^\d{9,18}$/.test(account)) missing.push({ name: r.name, reason: account ? 'account number looks wrong' : 'no bank account', amount: r.amount })
    else if (!IFSC_RE.test(ifsc)) missing.push({ name: r.name, reason: ifsc ? 'IFSC looks wrong' : 'no IFSC', amount: r.amount })
    else ok.push({ ...r, account, ifsc })
  }
  return { ok, missing }
}

function csvCell(v: string | number): string {
  const t = String(v)
  // Quote everything that could break a row; neutralise spreadsheet formulas.
  const safe = /^[=+\-@]/.test(t) ? `'${t}` : t
  return /[",\n\r]/.test(safe) || safe !== t ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function buildBankCsv(format: string, rows: BankRow[], narration: string): string {
  const f = BANK_FORMATS[format] ?? BANK_FORMATS.generic
  const lines = [f.columns.map((c) => csvCell(c.header)).join(',')]
  for (const r of rows) lines.push(f.columns.map((c) => csvCell(c.value(r, narration))).join(','))
  return lines.join('\r\n') + '\r\n'
}
