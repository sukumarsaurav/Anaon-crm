'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setLeaveBalance } from '@/lib/hr/actions'
import { LEAVE_TYPES } from '@/types/hr'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

interface Balance { id: string; user_id: string; leave_type: string; entitled: number; used: number; employee?: { full_name: string } | null }

interface Props {
  year: number
  balances: Balance[]
  employees: { id: string; full_name: string }[]
}

/**
 * Leave entitlements per employee and type. Approval adds to "used"; without an entitlement every
 * balance started at 0 and went negative.
 */
export default function LeaveBalancesPanel({ year, balances, employees }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    fd.set('year', String(year))
    setError(null)
    startTransition(async () => {
      const res = await setLeaveBalance(fd)
      if (!res.success) { setError(res.error ?? 'Could not save'); return }
      toast.success('Entitlement saved')
      router.refresh()
    })
  }

  const label = (t: string) => LEAVE_TYPES.find((l) => l.value === t)?.label ?? t
  const rows = [...balances].sort((a, b) => (a.employee?.full_name ?? '').localeCompare(b.employee?.full_name ?? '') || a.leave_type.localeCompare(b.leave_type))

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
        <h2 className="font-semibold text-slate-900 text-sm">Leave balances — {year}</h2>
      </div>
      <form onSubmit={onSubmit} className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end border-b border-slate-100">
        <Select name="user_id" label="Employee" placeholder="Choose…" options={employees.map((e) => ({ value: e.id, label: e.full_name }))} />
        <Select name="leave_type" label="Leave type" defaultValue="casual" options={LEAVE_TYPES} />
        <Input name="entitled" type="number" min={0} max={366} label="Days entitled" required />
        <Button type="submit" loading={pending}>Save entitlement</Button>
        {error && <p role="alert" className="sm:col-span-4 text-sm text-red-600">{error}</p>}
      </form>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-400 text-center">No entitlements set for {year}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wide bg-slate-50">
                <th scope="col" className="px-4 py-2 text-left">Employee</th>
                <th scope="col" className="px-4 py-2 text-left">Type</th>
                <th scope="col" className="px-4 py-2 text-right">Entitled</th>
                <th scope="col" className="px-4 py-2 text-right">Used</th>
                <th scope="col" className="px-4 py-2 text-right">Left</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((b) => {
                const left = b.entitled - b.used
                return (
                  <tr key={b.id}>
                    <td className="px-4 py-2 text-slate-900">{b.employee?.full_name ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{label(b.leave_type)}</td>
                    <td className="px-4 py-2 text-right">{b.entitled}</td>
                    <td className="px-4 py-2 text-right">{b.used}</td>
                    <td className={`px-4 py-2 text-right font-medium ${left < 0 ? 'text-red-600' : 'text-slate-900'}`}>{left}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
