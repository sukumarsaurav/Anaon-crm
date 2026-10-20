'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
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
      params.delete('page') // a new filter starts from page 1; page 3 of the old result may not exist
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
      params.delete('page')
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
    setSearch('')
    router.push(pathname)
  }

  const activeView = searchParams.get('view') || 'all'
  const activeStages = searchParams.getAll('stage') as LeadStage[]
  const activeSources = searchParams.getAll('source') as LeadSource[]
  const activeTemps = searchParams.getAll('temperature')
  const urlSearch = searchParams.get('search') || ''

  // Typing used to navigate on every keystroke: one server render and one history entry per
  // character, and the box (bound to the URL) lagged behind fast typing. Keep the text local and
  // write it to the URL once typing pauses, replacing the entry instead of pushing a new one.
  const [search, setSearch] = useState(urlSearch)
  const [seenUrlSearch, setSeenUrlSearch] = useState(urlSearch)
  if (seenUrlSearch !== urlSearch) {
    // Back/forward or "Clear filters" changed the URL: follow it.
    setSeenUrlSearch(urlSearch)
    setSearch(urlSearch)
  }
  useEffect(() => {
    if (search.trim() === urlSearch.trim()) return
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (search.trim()) params.set('search', search.trim())
      else params.delete('search')
      params.delete('page')
      router.replace(`${pathname}?${params.toString()}`)
    }, 350)
    return () => clearTimeout(t)
  }, [search, urlSearch, searchParams, router, pathname])

  const hasFilters = activeStages.length || activeSources.length || activeTemps.length || urlSearch

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
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-primary-300 hover:text-primary-600'
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
          <input aria-label="Search name, phone..."
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone..."
            className="text-sm text-slate-700 placeholder:text-slate-400 outline-none bg-transparent w-full"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
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
        <select aria-label="Sort leads by"
          value={`${searchParams.get('sort_by') || 'created_at'}:${searchParams.get('sort_dir') || 'desc'}`}
          onChange={(e) => {
            // One navigation: two setParam calls each built on the same old URL, so the second
            // (sort_dir) dropped the first (sort_by) and "Highest Score" never sorted by score.
            const [by, dir] = e.target.value.split(':')
            const params = new URLSearchParams(searchParams.toString())
            params.set('sort_by', by)
            params.set('sort_dir', dir)
            params.delete('page')
            router.push(`${pathname}?${params.toString()}`)
          }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
