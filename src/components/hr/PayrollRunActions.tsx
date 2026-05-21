'use client'

import { useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPayrollRun, finalizePayrollRun } from '@/lib/hr/actions'
import { MONTH_NAMES } from '@/types/hr'
import { Play, CheckCircle2, Plus } from 'lucide-react'

interface Props {
  existingMonths: { year: number; month: number }[]
}

export default function PayrollRunActions({ existingMonths }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const now = new Date()
  const defaultYear = now.getFullYear()
  const defaultMonth = now.getMonth() + 1

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setLoading(true)
    setError(null)
    startTransition(async () => {
      const result = await createPayrollRun(formData)
      setLoading(false)
      if (!result.success) setError(result.error ?? 'Failed')
      else { setOpen(false); router.refresh() }
    })
  }

  return (
    <div>
      {!open ? (
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 text-slate-500 text-sm rounded-xl hover:border-indigo-300 hover:text-indigo-600">
          <Plus size={16} /> New Payroll Run
        </button>
      ) : (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <p className="font-semibold text-slate-900 text-sm">New Payroll Run</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Year</label>
              <input name="year" type="number" required defaultValue={defaultYear} min={2020} max={2099}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Month</label>
              <select name="month" required defaultValue={defaultMonth}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400">
                {MONTH_NAMES.slice(1).map((m, i) => (
                  <option key={i+1} value={i+1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-600 mb-1">Notes</label>
              <input name="notes" placeholder="e.g. Includes Diwali bonus"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-slate-400" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)}
              className="px-3 py-2 text-sm border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 text-sm bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Generating...' : 'Generate Payslips'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export function FinalizeRunButton({ runId }: { runId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  function handleFinalize() {
    if (!confirmed) { setConfirmed(true); return }
    setLoading(true)
    startTransition(async () => {
      await finalizePayrollRun(runId)
      setLoading(false)
      router.refresh()
    })
  }

  return (
    <button onClick={handleFinalize} disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 ${
        confirmed ? 'bg-green-600 text-white hover:bg-green-700' : 'border border-green-300 text-green-700 hover:bg-green-50'
      }`}>
      <CheckCircle2 size={13} />
      {loading ? 'Finalizing...' : confirmed ? 'Confirm Finalize' : 'Finalize Run'}
    </button>
  )
}
