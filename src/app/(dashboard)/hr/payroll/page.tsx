export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getPayrollRuns, getPayrollSlips } from '@/lib/hr/queries'
import { MONTH_NAMES } from '@/types/hr'
import { formatDate, formatCurrency } from '@/lib/utils'
import PayrollRunActions, { FinalizeRunButton } from '@/components/hr/PayrollRunActions'
import { ArrowLeft, IndianRupee, Users, CheckCircle2, Download, FileText } from 'lucide-react'
import { loadBankRows } from '@/lib/hr/payrollExport'
import { splitPayable } from '@/lib/hr/bankExport'
import SlipAdjustButton from '@/components/hr/SlipAdjustButton'
import { getProfile } from '@/lib/supabase/getProfile'

export const metadata = { title: 'Payroll' }

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  // Salaries are admin-only (RLS too); managers used to get full read/write through the API.
  if ((await getProfile())?.profile?.role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-6 text-center">
          Payroll is managed by admins. Your own payslips are under Team → Attendance.
        </p>
      </div>
    )
  }
  const { run: runParam } = await searchParams
  const runs = await getPayrollRuns()
  const latestRun = runs.find((r) => r.id === runParam) ?? runs[0] ?? null
  const latestSlips = latestRun ? await getPayrollSlips(latestRun.id) : []

  const existingMonths = runs.map(r => ({ year: r.year, month: r.month }))
  const canAdjust = latestRun?.status !== 'completed'
  // Bank file pre-check: who would be left out of the transfer and why.
  const bank = latestRun?.status === 'completed' ? await loadBankRows(latestRun.id) : null
  const heldBack = bank ? splitPayable(bank.rows).missing : []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/hr" className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payroll</h1>
          <p className="text-sm text-slate-500">{runs.length} payroll runs</p>
        </div>
      </div>

      <PayrollRunActions existingMonths={existingMonths} />

      {/* Latest run detail */}
      {latestRun && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {MONTH_NAMES[latestRun.month]} {latestRun.year}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {latestRun.total_employees} employees · Generated {formatDate(latestRun.created_at)}
                  {latestRun.processor && ` · Finalized by ${latestRun.processor.full_name}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  latestRun.status === 'completed' ? 'bg-green-50 text-green-700' :
                  latestRun.status === 'processing' ? 'bg-amber-50 text-amber-700' :
                  'bg-slate-100 text-slate-500'
                }`}>{latestRun.status}</span>
                {latestRun.status !== 'completed' && (
                  <FinalizeRunButton runId={latestRun.id} />
                )}
                {latestRun.status === 'completed' && (
                  <a href={`/api/hr/payroll/${latestRun.id}/bank-export?format=generic`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
                    <Download size={13} /> Bank transfer file (CSV)
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              {[
                { label: 'Gross Payout', value: formatCurrency(latestRun.total_gross, { precision: 2 }), icon: IndianRupee },
                { label: 'Deductions', value: formatCurrency(latestRun.total_deductions), icon: IndianRupee },
                { label: 'Net Payout', value: formatCurrency(latestRun.total_net, { precision: 2 }), icon: IndianRupee },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {heldBack.length > 0 && (
            <div role="alert" className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <p className="font-medium">Not in the bank file ({heldBack.length}) — pay these separately or fix their bank details in HR → Employees:</p>
              <ul className="mt-1 list-disc pl-5">
                {heldBack.map((m) => <li key={m.name}>{m.name}: {m.reason} ({formatCurrency(m.amount, { mode: 'exact' })})</li>)}
              </ul>
            </div>
          )}

          {latestSlips.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900 text-sm">
                  Payslips — {MONTH_NAMES[latestRun.month]} {latestRun.year}
                </h2>
              </div>
              <div className="overflow-x-auto [&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:bg-slate-50 [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                      <th scope="col" className="px-4 py-2.5 text-left">Employee</th>
                      <th scope="col" className="px-4 py-2.5 text-right">Present</th>
                      <th scope="col" className="px-4 py-2.5 text-right">LOP</th>
                      <th scope="col" className="px-4 py-2.5 text-right">Gross</th>
                      <th scope="col" className="px-4 py-2.5 text-right">PF</th>
                      <th scope="col" className="px-4 py-2.5 text-right">Prof Tax</th>
                      <th scope="col" className="px-4 py-2.5 text-right">Incentives</th>
                      <th scope="col" className="px-4 py-2.5 text-right">Net Pay</th>
                      <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {latestSlips.map(slip => (
                      <tr key={slip.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{slip.employee?.full_name}</p>
                          <p className="text-xs text-slate-400">{slip.employee?.designation}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {slip.present_days}/{slip.working_days}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {slip.lop_days > 0 ? (
                            <span className="text-red-600 font-medium">{slip.lop_days}</span>
                          ) : <span className="text-slate-300">0</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(slip.gross, { mode: 'exact' })}</td>
                        <td className="px-4 py-3 text-right text-slate-500 text-xs">{formatCurrency(slip.pf_employee, { mode: 'exact' })}</td>
                        <td className="px-4 py-3 text-right text-slate-500 text-xs">{formatCurrency(slip.professional_tax, { mode: 'exact' })}</td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {slip.incentives > 0 ? formatCurrency(slip.incentives, { mode: 'exact' }) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {formatCurrency(slip.net_pay, { mode: 'exact' })}
                        </td>
                        <td className="px-2 py-3 text-right whitespace-nowrap">
                          <a href={`/api/documents/payslip/${slip.id}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary-600 hover:underline">
                            <FileText size={12} /> PDF
                          </a>
                          {canAdjust && (
                            <SlipAdjustButton slipId={slip.id} name={slip.employee?.full_name ?? 'Employee'}
                              presentDays={slip.present_days} workingDays={slip.working_days} incentives={slip.incentives} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-semibold">
                      <td className="px-4 py-3 text-slate-700">Total</td>
                      <td colSpan={5} />
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatCurrency(latestSlips.reduce((s, sl) => s + sl.incentives, 0), { mode: 'exact' })}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-900">
                        {formatCurrency(latestSlips.reduce((s, sl) => s + sl.net_pay, 0), { mode: 'exact' })}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* All runs history */}
      {runs.length > 1 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 text-sm">Payroll History</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {runs.filter((r) => r.id !== latestRun?.id).map(run => (
              <Link key={run.id} href={`/hr/payroll?run=${run.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-900">{MONTH_NAMES[run.month]} {run.year}</p>
                  <p className="text-xs text-slate-400">{run.total_employees} employees · {formatDate(run.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{formatCurrency(run.total_net, { precision: 2 })}</p>
                  <span className={`text-xs ${run.status === 'completed' ? 'text-green-600' : 'text-slate-400'}`}>
                    {run.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
