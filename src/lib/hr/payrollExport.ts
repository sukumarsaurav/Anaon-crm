import { createServiceClient } from '@/lib/supabase/service'
import { decryptPii } from '@/lib/security/pii'
import type { BankRow } from './bankExport'

const MONTHS = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/**
 * Net pay and (decrypted) bank details for every slip of a run. Service role: account numbers are
 * stored encrypted. Callers must be admins — this is the full salary list.
 */
export async function loadBankRows(runId: string): Promise<{ run: { year: number; month: number; status: string }; rows: BankRow[]; narration: string } | null> {
  const svc = createServiceClient()
  const { data: run } = await svc.from('payroll_runs').select('year, month, status').eq('id', runId).maybeSingle()
  if (!run) return null
  const { data: slips } = await svc
    .from('payroll_slips')
    .select('net_pay, employee:profiles!payroll_slips_user_id_fkey(full_name, email, employee_id, bank_account, bank_ifsc)')
    .eq('run_id', runId)
  const rows: BankRow[] = (slips ?? []).map((s) => {
    const e = (Array.isArray(s.employee) ? s.employee[0] : s.employee) as Record<string, string | null> | null
    return {
      name: e?.full_name ?? 'Unknown',
      account: decryptPii(e?.bank_account ?? null),
      ifsc: e?.bank_ifsc ?? null,
      amount: Number(s.net_pay ?? 0),
      email: e?.email ?? null,
      employeeId: e?.employee_id ?? null,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))
  return { run, rows, narration: `SALARY ${MONTHS[run.month]} ${run.year}` }
}
