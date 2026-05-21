'use client'

import { useState } from 'react'
import { PLOT_STATUS_CONFIG } from '@/types/inventory'
import type { Plot, PlotStatus } from '@/types/inventory'
import PlotDetailPanel from './PlotDetailPanel'

interface Props {
  plots: Plot[]
  projectId: string
  canManage: boolean
}

const STATUS_FILTERS: Array<{ label: string; value: PlotStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Available', value: 'available' },
  { label: 'Soft Hold', value: 'soft_hold' },
  { label: 'Booked', value: 'booked' },
  { label: 'Sold', value: 'sold' },
  { label: 'Not for Sale', value: 'not_for_sale' },
]

// Natural sort for plot numbers like A-1, A-10, B-2
function naturalSort(a: Plot, b: Plot) {
  return a.plot_number.localeCompare(b.plot_number, undefined, { numeric: true, sensitivity: 'base' })
}

export default function PlotGrid({ plots, projectId, canManage }: Props) {
  const [filter, setFilter] = useState<PlotStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Plot | null>(null)

  const filtered = plots
    .filter((p) => filter === 'all' || p.status === filter)
    .filter((p) => !search || p.plot_number.toLowerCase().includes(search.toLowerCase()))
    .sort(naturalSort)

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search plot number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
        />
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                filter === f.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
              {f.value !== 'all' && (
                <span className="ml-1 opacity-70">
                  {plots.filter((p) => p.status === f.value).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {(Object.entries(PLOT_STATUS_CONFIG) as Array<[PlotStatus, typeof PLOT_STATUS_CONFIG[PlotStatus]]>).map(([status, cfg]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${cfg.mapColor.split(' ')[0]}`} />
            <span className="text-xs text-slate-600">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">No plots match this filter</div>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))' }}>
          {filtered.map((plot) => {
            const cfg = PLOT_STATUS_CONFIG[plot.status]
            const isSelected = selected?.id === plot.id
            return (
              <button
                key={plot.id}
                onClick={() => setSelected(plot.status === 'not_for_sale' ? null : plot)}
                disabled={plot.status === 'not_for_sale'}
                title={`${plot.plot_number} — ${cfg.label}${plot.size_sqyd ? ` (${plot.size_sqyd} sq yd)` : ''}`}
                className={`relative aspect-square rounded-lg flex flex-col items-center justify-center text-white text-xs font-bold transition-all border-2 ${
                  isSelected ? 'border-indigo-600 ring-2 ring-indigo-400 scale-105' : 'border-transparent'
                } ${cfg.mapColor}`}
              >
                <span className="leading-tight text-center px-1 break-all">{plot.plot_number}</span>
                {plot.size_sqyd && (
                  <span className="text-[9px] opacity-80 leading-none">{plot.size_sqyd}sy</span>
                )}
                {plot.status === 'soft_hold' && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border border-white" />
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Detail panel slide-over */}
      {selected && (
        <PlotDetailPanel
          plot={selected}
          canManage={canManage}
          onClose={() => setSelected(null)}
          onUpdate={(updated) => setSelected(updated)}
        />
      )}
    </div>
  )
}
