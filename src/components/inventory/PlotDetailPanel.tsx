'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { X, FileText, Unlock, PenLine } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { softHoldPlot, releaseHold } from '@/lib/inventory/actions'
import { PLOT_STATUS_CONFIG, PROJECT_TYPE_LABELS } from '@/types/inventory'
import PlotStatusBadge from './PlotStatusBadge'
import type { Plot } from '@/types/inventory'

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

  function handleHold() {
    startTransition(async () => {
      const result = await softHoldPlot(plot.id)
      if (result.success) {
        onUpdate({ ...plot, status: 'soft_hold', held_until: result.expires_at ?? null })
      }
    })
  }

  function handleRelease() {
    startTransition(async () => {
      const result = await releaseHold(plot.id)
      if (result.success) {
        onUpdate({ ...plot, status: 'available', held_by: null, held_until: null })
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-sm bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-900 text-lg">Plot {plot.plot_number}</h2>
            <PlotStatusBadge status={plot.status} />
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
        </div>

        {/* Details */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Pricing */}
          <div className="bg-slate-50 rounded-xl p-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pricing</h3>
            <Row label="Base Price" value={formatCurrency(plot.base_price)} />
            {plot.corner_premium > 0 && <Row label="Corner Premium" value={formatCurrency(plot.corner_premium)} />}
            {plot.facing_premium > 0 && <Row label="Facing Premium" value={formatCurrency(plot.facing_premium)} />}
            {plot.other_premium > 0  && <Row label="Other Premium"  value={formatCurrency(plot.other_premium)} />}
            {plot.development_charges > 0 && <Row label="Dev. Charges" value={formatCurrency(plot.development_charges)} />}
            <div className="flex justify-between pt-2 mt-1 border-t border-slate-200">
              <span className="text-sm font-semibold text-slate-700">Total Price</span>
              <span className="text-sm font-bold text-indigo-700">{formatCurrency(plot.total_price ?? 0)}</span>
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
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-slate-200 space-y-2">
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
      </div>
    </div>
  )
}
