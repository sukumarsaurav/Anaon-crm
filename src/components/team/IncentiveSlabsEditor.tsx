'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { saveIncentiveSlabs } from '@/lib/team/incentives'
import { calculateCommission, slabProblem, type SlabDraft } from '@/lib/team/commission'
import { formatCurrency } from '@/lib/utils'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import type { IncentiveSlab } from '@/types/team'

const cell = 'w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-500'

export default function IncentiveSlabsEditor({ slabs, canEdit }: { slabs: IncentiveSlab[]; canEdit: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [rows, setRows] = useState<SlabDraft[]>(() => slabs.map(({ id, label, from_bookings, to_bookings, commission_percent, bonus_amount, is_active }) =>
    ({ id, label, from_bookings, to_bookings, commission_percent: Number(commission_percent), bonus_amount: Number(bonus_amount), is_active })))
  const [bookings, setBookings] = useState(4)
  const [revenue, setRevenue] = useState(20_000_000)

  const problem = useMemo(() => slabProblem(rows), [rows])
  const preview = useMemo(() => calculateCommission(bookings, revenue,
    rows.map((r, i) => ({ ...r, id: r.id ?? `new-${i}`, sort_order: r.from_bookings, created_at: '' }) as IncentiveSlab)), [rows, bookings, revenue])

  const set = (i: number, patch: Partial<SlabDraft>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const num = (v: string) => (v === '' ? 0 : Number(v))

  function addSlab() {
    const top = [...rows].filter((r) => r.is_active).sort((a, b) => b.from_bookings - a.from_bookings)[0]
    const from = top ? (top.to_bookings ?? top.from_bookings) + 1 : 0
    // Close the current open-ended top slab so the new one can be the top.
    setRows((rs) => [...rs.map((r) => (r === top && r.to_bookings == null ? { ...r, to_bookings: from - 1 } : r)),
      { label: 'New slab', from_bookings: from, to_bookings: null, commission_percent: 0, bonus_amount: 0, is_active: true }])
  }

  function save() {
    startTransition(async () => {
      const res = await saveIncentiveSlabs(rows)
      if (!res.success) { toast.error(res.error ?? 'Could not save'); return }
      toast.success('Incentive slabs saved')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
            <tr>
              <th scope="col" className="px-3 py-2.5 text-left">Slab</th>
              <th scope="col" className="px-3 py-2.5 text-left">Bookings from</th>
              <th scope="col" className="px-3 py-2.5 text-left">to (empty = and above)</th>
              <th scope="col" className="px-3 py-2.5 text-left">Commission % of revenue</th>
              <th scope="col" className="px-3 py-2.5 text-left">Bonus ₹</th>
              <th scope="col" className="px-3 py-2.5 text-left">Active</th>
              {canEdit && <th scope="col" className="px-3 py-2.5"><span className="sr-only">Remove</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={r.id ?? `new-${i}`}>
                <td className="px-3 py-2"><input aria-label="Slab name" className={cell} disabled={!canEdit} value={r.label} onChange={(e) => set(i, { label: e.target.value })} /></td>
                <td className="px-3 py-2"><input aria-label="From bookings" type="number" min={0} className={cell} disabled={!canEdit} value={r.from_bookings} onChange={(e) => set(i, { from_bookings: num(e.target.value) })} /></td>
                <td className="px-3 py-2"><input aria-label="To bookings" type="number" min={0} className={cell} disabled={!canEdit} value={r.to_bookings ?? ''} onChange={(e) => set(i, { to_bookings: e.target.value === '' ? null : Number(e.target.value) })} /></td>
                <td className="px-3 py-2"><input aria-label="Commission percent" type="number" min={0} max={10} step={0.1} className={cell} disabled={!canEdit} value={r.commission_percent} onChange={(e) => set(i, { commission_percent: num(e.target.value) })} /></td>
                <td className="px-3 py-2"><input aria-label="Bonus amount" type="number" min={0} step={1000} className={cell} disabled={!canEdit} value={r.bonus_amount} onChange={(e) => set(i, { bonus_amount: num(e.target.value) })} /></td>
                <td className="px-3 py-2"><input aria-label="Active" type="checkbox" disabled={!canEdit} checked={r.is_active} onChange={(e) => set(i, { is_active: e.target.checked })} /></td>
                {canEdit && (
                  <td className="px-3 py-2 text-right">
                    <button type="button" aria-label={`Remove ${r.label}`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="secondary" size="sm" onClick={addSlab}><Plus size={14} /> Add slab</Button>
          <Button size="sm" onClick={save} loading={pending} disabled={!!problem}>Save slabs</Button>
          {problem && <p role="alert" className="text-sm text-amber-700">{problem}</p>}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="font-semibold text-slate-900 text-sm">Preview</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          The slab is chosen by the number of confirmed bookings in the month; its commission % applies to the month’s whole booking revenue, plus the slab bonus.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1 text-xs text-slate-600">Bookings this month
            <input type="number" min={0} value={bookings} onChange={(e) => setBookings(num(e.target.value))} className={`${cell} w-32`} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">Booking revenue (₹)
            <input type="number" min={0} step={100000} value={revenue} onChange={(e) => setRevenue(num(e.target.value))} className={`${cell} w-44`} />
          </label>
          <p className="text-slate-700">
            {preview.current_slab ? <>Slab <strong>{preview.current_slab.label}</strong> → commission {formatCurrency(preview.commission_amount, { mode: 'exact' })} + bonus {formatCurrency(preview.bonus_amount, { mode: 'exact' })} = <strong>{formatCurrency(preview.commission_amount + preview.bonus_amount, { mode: 'exact' })}</strong></> : 'No slab matches'}
          </p>
        </div>
      </div>
    </div>
  )
}
