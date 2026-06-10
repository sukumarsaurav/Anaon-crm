'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { STAGE_CONFIG, SOURCE_LABELS, STAGE_ORDER } from '@/types/leads'
import type { LeadStage, LeadSource } from '@/types/leads'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const VIEW_TABS = [
  { value: 'all', label: 'All Leads' },
  { value: 'my_leads', label: 'My Leads' },
  { value: 'hot', label: 'Hot Leads' },
  { value: 'today', label: 'Follow-up Today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'visits_week', label: 'Site Visits This Week' },
  { value: 'ready_to_buy', label: 'Ready to Buy' },
  { value: 'future_buyers', label: 'Future Buyers' },
  { value: 'new_today', label: 'New Today' },
]

const TEMPERATURE_OPTIONS = [
  { value: 'hot', label: 'Hot' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
]

export default function LeadFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const toggleArrayParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      const current = params.getAll(key)
      if (current.includes(value)) {
        params.delete(key)
        current.filter((v) => v !== value).forEach((v) => params.append(key, v))
      } else {
        params.append(key, value)
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const clearFilters = () => {
    router.push(pathname)
  }

  const activeView = searchParams.get('view') || 'all'
  const activeStages = searchParams.getAll('stage') as LeadStage[]
  const activeSources = searchParams.getAll('source') as LeadSource[]
  const activeTemps = searchParams.getAll('temperature')
  const search = searchParams.get('search') || ''
  const hasFilters = activeStages.length || activeSources.length || activeTemps.length || search

  return (
    <div className="space-y-3">
      {/* View tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setParam('view', tab.value === 'all' ? null : tab.value)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
              activeView === tab.value || (tab.value === 'all' && !searchParams.get('view'))
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 w-64">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setParam('search', e.target.value || null)}
            placeholder="Search name, phone..."
            className="text-sm text-slate-700 placeholder:text-slate-400 outline-none bg-transparent w-full"
          />
          {search && (
            <button onClick={() => setParam('search', null)}>
              <X size={14} className="text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>

        {/* Stage filter */}
        <div className="flex items-center gap-1 flex-wrap">
          {STAGE_ORDER.slice(0, 6).map((stage) => {
            const cfg = STAGE_CONFIG[stage]
            const active = activeStages.includes(stage)
            return (
              <button
                key={stage}
                onClick={() => toggleArrayParam('stage', stage)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-full border transition-all',
                  active
                    ? `${cfg.bgColor} ${cfg.textColor} ${cfg.borderColor}`
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                )}
              >
                {cfg.label}
              </button>
            )
          })}
        </div>

        {/* Temperature */}
        <div className="flex items-center gap-1">
          {TEMPERATURE_OPTIONS.map((t) => (
            <button
              key={t.value}
              onClick={() => toggleArrayParam('temperature', t.value)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-full border transition-all',
                activeTemps.includes(t.value)
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={`${searchParams.get('sort_by') || 'created_at'}:${searchParams.get('sort_dir') || 'desc'}`}
          onChange={(e) => {
            const [by, dir] = e.target.value.split(':')
            setParam('sort_by', by)
            setParam('sort_dir', dir)
          }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="created_at:desc">Newest First</option>
          <option value="created_at:asc">Oldest First</option>
          <option value="score:desc">Highest Score</option>
          <option value="next_followup_at:asc">Next Follow-up</option>
        </select>

        {/* Clear */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X size={14} />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  )
}
