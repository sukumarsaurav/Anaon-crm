'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { FileText, Unlock, PenLine } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { softHoldPlot, releaseHold } from '@/lib/inventory/actions'
import { getPlotHoldsLog } from '@/lib/inventory/queries'
import { PLOT_STATUS_CONFIG, PROJECT_TYPE_LABELS } from '@/types/inventory'
import Drawer from '@/components/ui/Drawer'
import PlotStatusBadge from './PlotStatusBadge'
import type { Plot, PlotHoldLog } from '@/types/inventory'

interface Props {
  plot: Plot
  canManage: boolean
  onClose: () => void
  onUpdate: (plot: Plot) => void
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-medium text-slate-900 text-right max-w-[60%]">{value}</span>
    </div>
  )
}

export default function PlotDetailPanel({ plot, canManage, onClose, onUpdate }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<{ key: string; rows: PlotHoldLog[] } | null>(null)
  const historyKey = `${plot.id}:${plot.status}`

  // Hold history for this plot (who held it, when, and how it ended); refetched after a hold change.
  useEffect(() => {
    let live = true
    getPlotHoldsLog(plot.id)
      .then((rows) => { if (live) setHistory({ key: historyKey, rows }) })
      .catch(() => { if (live) setHistory({ key: historyKey, rows: [] }) })
    return () => { live = false }
  }, [plot.id, historyKey])
  const holds = history?.key === historyKey ? history.rows : null

  // Errors are shown: "maximum 3 holds" or "someone else just took this plot" used to do nothing.
  function handleHold() {
    setError(null)
    startTransition(async () => {
      const result = await softHoldPlot(plot.id)
      if (result.success) onUpdate({ ...plot, status: 'soft_hold', held_until: result.expires_at ?? null })
      else setError(result.error ?? 'Could not hold the plot')
    })
  }

  function handleRelease() {
    setError(null)
    startTransition(async () => {
      const result = await releaseHold(plot.id)
      if (result.success) onUpdate({ ...plot, status: 'available', held_by: null, held_until: null })
      else setError(result.error ?? 'Could not release the hold')
    })
  }

  const actions = (
    <div className="space-y-2">
          {error && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <Link
            href={`/inventory/${plot.project_id}/plots/${plot.id}/cost-sheet`}
            target="_blank"
            className="block w-full text-center py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium"
          >
            <FileText size={14} className="inline-block mr-1.5 -mt-0.5" />View Cost Sheet
          </Link>

          {plot.status === 'available' && (
            <button
              onClick={handleHold}
              disabled={isPending}
              className="w-full py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40 font-medium"
            >
              Place Soft Hold
            </button>
          )}

          {plot.status === 'soft_hold' && (
            <button
              onClick={handleRelease}
              disabled={isPending}
              className="w-full py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-40 font-medium flex items-center justify-center gap-1.5"
            >
              <Unlock size={14} /> Release Hold
            </button>
          )}

          {canManage && (
            <Link
              href={`/inventory/${plot.project_id}/plots/${plot.id}/edit`}
              className="flex items-center justify-center gap-1.5 w-full py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
            >
              <PenLine size={14} /> Edit Plot
            </Link>
          )}
    </div>
  )

  return (
    <Drawer
      open
      onClose={onClose}
      ariaLabel={`Plot ${plot.plot_number} details`}
      title={<><span>Plot {plot.plot_number}</span><PlotStatusBadge status={plot.status} /></>}
      footer={actions}
    >
      <div className="p-4 space-y-4">
          {/* Pricing */}
          <div className="bg-slate-50 rounded-xl p-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pricing</h3>
            <Row label="Base Price" value={formatCurrency(plot.base_price)} />
            {/* Corner / facing premiums are percentages of the base price (see total_price). */}
            {plot.corner_premium > 0 && <Row label={`Corner Premium (${plot.corner_premium}%)`} value={formatCurrency(Math.round(plot.base_price * plot.corner_premium / 100))} />}
            {plot.facing_premium > 0 && <Row label={`Facing Premium (${plot.facing_premium}%)`} value={formatCurrency(Math.round(plot.base_price * plot.facing_premium / 100))} />}
            {plot.other_premium > 0  && <Row label="Other Premium"  value={formatCurrency(plot.other_premium)} />}
            {plot.development_charges > 0 && <Row label="Dev. Charges" value={formatCurrency(plot.development_charges)} />}
            <div className="flex justify-between pt-2 mt-1 border-t border-slate-200">
              <span className="text-sm font-semibold text-slate-700">Total Price</span>
              <span className="text-sm font-bold text-primary-700">{formatCurrency(plot.total_price ?? 0)}</span>
            </div>
          </div>

          {/* Details */}
          <div className="bg-slate-50 rounded-xl p-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Plot Details</h3>
            <Row label="Size" value={plot.size_sqyd ? `${plot.size_sqyd} sq yd` : plot.size_sqft ? `${plot.size_sqft} sq ft` : null} />
            <Row label="Type" value={plot.type.replace('_', ' ')} />
            <Row label="Facing" value={plot.facing ?? null} />
            <Row label="Configuration" value={plot.configuration} />
            <Row label="Floor" value={plot.floor_number} />
          </div>

          {/* Hold info */}
          {plot.status === 'soft_hold' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Hold Details</h3>
              {plot.held_by_profile && <Row label="Held by" value={plot.held_by_profile.full_name} />}
              {plot.held_until && <Row label="Expires at" value={formatDateTime(plot.held_until)} />}
            </div>
          )}

          {plot.notes && (
            <div className="bg-slate-50 rounded-xl p-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</h3>
              <p className="text-xs text-slate-700">{plot.notes}</p>
            </div>
          )}

          <div className="bg-slate-50 rounded-xl p-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Hold history</h3>
            {holds === null ? (
              <p className="text-xs text-slate-400">Loading…</p>
            ) : holds.length === 0 ? (
              <p className="text-xs text-slate-400">Never held.</p>
            ) : (
              <ul className="space-y-1.5">
                {holds.slice(0, 10).map((h) => (
                  <li key={h.id} className="flex justify-between gap-2 text-xs">
                    <span className="text-slate-700">{h.held_by_profile?.full_name ?? 'Advisor'} · {formatDateTime(h.held_at)}</span>
                    <span className="text-slate-500 capitalize">{h.outcome ?? (h.released_at ? 'released' : 'active')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
    </Drawer>
  )
}
