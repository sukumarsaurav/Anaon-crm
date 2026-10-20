'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { savePremiumMatrix } from '@/lib/inventory/actions'
import type { PremiumMatrix } from '@/types/inventory'
import Button from '@/components/ui/Button'

const TYPES: { type: string; label: string }[] = [
  { type: 'corner', label: 'Corner' },
  { type: 'park_facing', label: 'Park facing' },
  { type: 'road_facing', label: 'Road facing' },
  { type: 'east_facing', label: 'East facing' },
  { type: 'other', label: 'Other' },
]

/**
 * Project premiums as a % of the base price. New plots pick these up from their type
 * (corner → corner premium, park / road facing → facing premium).
 */
export default function PremiumMatrixEditor({ projectId, matrix }: { projectId: string; matrix: PremiumMatrix[] }) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(TYPES.map(({ type }) => [type, String(matrix.find((m) => m.premium_type === type)?.percent ?? '')])),
  )
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  function save() {
    const premiums = TYPES
      .filter(({ type }) => values[type] !== '')
      .map(({ type, label }) => ({ type, label, percent: Number(values[type]) }))
    if (premiums.some((p) => !Number.isFinite(p.percent) || p.percent < 0 || p.percent > 100)) {
      setMessage({ ok: false, text: 'Premiums must be between 0 and 100 %' })
      return
    }
    setMessage(null)
    startTransition(async () => {
      const res = await savePremiumMatrix(projectId, premiums)
      setMessage(res.success ? { ok: true, text: 'Saved' } : { ok: false, text: res.error ?? 'Could not save' })
      if (res.success) router.refresh()
    })
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="font-semibold text-slate-900">Premium matrix</h3>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">% of the base price, applied to new plots by type.</p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {TYPES.map(({ type, label }) => (
          <label key={type} className="text-xs text-slate-600">
            {label}
            <div className="mt-1 flex items-center rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-primary-500/30">
              <input type="number" min={0} max={100} step="0.5" value={values[type]}
                onChange={(e) => setValues((v) => ({ ...v, [type]: e.target.value }))}
                className="w-full min-w-0 rounded-lg px-2 py-1.5 text-sm outline-none" />
              <span className="pr-2 text-slate-400">%</span>
            </div>
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" onClick={save} loading={pending}>Save premiums</Button>
        {message && <span role={message.ok ? 'status' : 'alert'} className={`text-xs ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</span>}
      </div>
    </div>
  )
}
