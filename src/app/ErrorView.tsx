'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

/** Shared body for route error boundaries. */
export default function ErrorView({
  error,
  reset,
  fullscreen = false,
}: {
  error: Error & { digest?: string }
  reset: () => void
  fullscreen?: boolean
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className={fullscreen ? 'min-h-screen flex items-center justify-center p-6 bg-slate-50' : 'p-6'}>
      <div role="alert" className="max-w-md mx-auto bg-white rounded-xl border border-slate-200 p-8 text-center">
        <div className="mx-auto mb-4 size-12 rounded-full bg-red-50 flex items-center justify-center">
          <AlertTriangle size={24} className="text-red-600" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
        <p className="text-sm text-slate-500 mt-1">
          This page failed to load. You can try again, or go back to the dashboard.
        </p>
        {error.digest && <p className="text-xs text-slate-400 mt-3 font-mono">Ref: {error.digest}</p>}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover focus-ring"
          >
            Try again
          </button>
          {/* Plain anchor on purpose: a full navigation clears a broken client state. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="h-10 px-4 inline-flex items-center rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 focus-ring"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
