'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Users, UserCheck, Building2, FileText, CornerDownLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface Result {
  id: string
  label: string
  sub: string | null
  group: 'Leads' | 'Clients' | 'Projects' | 'Bookings'
  href: string
}

export default function CommandPalette() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Global ⌘K / Ctrl+K toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Reset + focus on open; scroll-lock.
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActive(0)
      document.body.style.overflow = 'hidden'
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const search = useCallback(
    async (q: string) => {
      const term = q.trim()
      if (term.length < 2) {
        setResults([])
        return
      }
      setLoading(true)
      const pattern = `full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`
      const [leads, clients, projects, bookings] = await Promise.all([
        supabase.from('leads').select('id, full_name, phone').eq('is_active', true).or(pattern).limit(5),
        supabase.from('clients').select('id, full_name, phone').or(pattern).limit(5),
        supabase.from('projects').select('id, name, city').or(`name.ilike.%${term}%,city.ilike.%${term}%`).limit(4),
        supabase.from('bookings').select('id, booking_number').ilike('booking_number', `%${term}%`).limit(4),
      ])
      const out: Result[] = [
        ...(leads.data ?? []).map((l) => ({
          id: l.id as string,
          label: (l.full_name as string) ?? 'Unnamed lead',
          sub: (l.phone as string) ?? null,
          group: 'Leads' as const,
          href: `/leads/${l.id}`,
        })),
        ...(clients.data ?? []).map((c) => ({
          id: c.id as string,
          label: (c.full_name as string) ?? 'Unnamed client',
          sub: (c.phone as string) ?? null,
          group: 'Clients' as const,
          href: `/clients/${c.id}`,
        })),
        ...(projects.data ?? []).map((p) => ({
          id: p.id as string,
          label: (p.name as string) ?? 'Untitled project',
          sub: (p.city as string) ?? null,
          group: 'Projects' as const,
          href: `/inventory/${p.id}`,
        })),
        ...(bookings.data ?? []).map((b) => ({
          id: b.id as string,
          label: (b.booking_number as string) ?? 'Booking',
          sub: 'Booking',
          group: 'Bookings' as const,
          href: `/bookings/${b.id}`,
        })),
      ]
      setResults(out)
      setActive(0)
      setLoading(false)
    },
    [supabase],
  )

  // Debounce.
  useEffect(() => {
    const t = setTimeout(() => search(query), 200)
    return () => clearTimeout(t)
  }, [query, search])

  const go = useCallback(
    (r: Result | undefined) => {
      if (!r) return
      setOpen(false)
      router.push(r.href)
    },
    [router],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(results[active])
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-slate-50 rounded-lg pl-3 pr-2 py-2 border border-slate-200 hover:border-slate-300 transition-colors text-slate-400 focus-ring w-full max-w-xs"
        aria-label="Open search"
      >
        <Search size={15} className="shrink-0" />
        <span className="text-sm flex-1 text-left">Search leads, clients…</span>
        <kbd className="hidden sm:inline-flex text-[10px] font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded shrink-0">
          ⌘K
        </kbd>
      </button>
    )
  }

  let lastGroup: string | null = null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden="true" />

      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-3 px-4 border-b border-slate-200">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search leads and clients by name, phone, or email…"
            className="flex-1 h-12 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
            aria-label="Search query"
          />
          <kbd className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">esc</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-2">
          {query.trim().length < 2 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Type at least 2 characters to search.</p>
          ) : loading ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No results for “{query}”.</p>
          ) : (
            results.map((r, i) => {
              const showHeader = r.group !== lastGroup
              lastGroup = r.group
              const Icon = r.group === 'Leads' ? Users
                : r.group === 'Clients' ? UserCheck
                : r.group === 'Projects' ? Building2
                : FileText
              return (
                <div key={`${r.group}-${r.id}`}>
                  {showHeader && (
                    <p className="px-4 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{r.group}</p>
                  )}
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      i === active ? 'bg-primary/10' : 'hover:bg-slate-50',
                    )}
                  >
                    <span className="size-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-slate-500" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900 truncate">{r.label}</span>
                      {r.sub && <span className="block text-xs text-slate-500 truncate">{r.sub}</span>}
                    </span>
                    {i === active && <CornerDownLeft size={14} className="text-slate-400 shrink-0" />}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
