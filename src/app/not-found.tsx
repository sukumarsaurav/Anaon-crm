import Link from 'next/link'
import { SearchX } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md bg-white rounded-xl border border-slate-200 p-8 text-center">
        <div className="mx-auto mb-4 size-12 rounded-full bg-slate-100 flex items-center justify-center">
          <SearchX size={24} className="text-slate-500" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">Page not found</h1>
        <p className="text-sm text-slate-500 mt-1">
          It may have been moved or deleted, or you may not have access to it.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-10 items-center px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover focus-ring"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  )
}
