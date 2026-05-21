'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export default function DateRangeFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function handleChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const from = fd.get('from') as string
    const to = fd.get('to') as string
    const q = new URLSearchParams()
    if (from) q.set('from', from)
    if (to) q.set('to', to)
    router.push(`${pathname}?${q.toString()}`)
  }

  function handleClear() {
    router.push(pathname)
  }

  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''

  return (
    <form onSubmit={handleChange} className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
        <label className="text-xs text-slate-500 shrink-0">From</label>
        <input name="from" type="date" defaultValue={from}
          className="text-sm text-slate-700 focus:outline-none" />
        <span className="text-slate-300">→</span>
        <label className="text-xs text-slate-500 shrink-0">To</label>
        <input name="to" type="date" defaultValue={to}
          className="text-sm text-slate-700 focus:outline-none" />
      </div>
      <button type="submit"
        className="px-3 py-2 text-xs bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700">
        Apply
      </button>
      {(from || to) && (
        <button type="button" onClick={handleClear}
          className="px-3 py-2 text-xs border border-slate-300 text-slate-500 rounded-xl hover:bg-slate-50">
          Clear
        </button>
      )}
    </form>
  )
}
