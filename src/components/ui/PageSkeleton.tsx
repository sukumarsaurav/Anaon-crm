/**
 * Generic route-level loading skeleton. Mirrors the common page shape across
 * the CRM (PageHeader + optional stat cards + a table/list block) so that
 * navigation shows an instant placeholder instead of a blank screen while the
 * server component fetches its data.
 */
export default function PageSkeleton({
  stats = 4,
  rows = 8,
  cards = false,
}: {
  /** Number of stat cards to render. 0 hides the stats row. */
  stats?: number
  /** Number of list/table rows (or grid cards when `cards`) to render. */
  rows?: number
  /** Render the body as a card grid instead of stacked table rows. */
  cards?: boolean
}) {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 bg-slate-200 rounded-lg" />
          <div className="h-4 w-32 bg-slate-100 rounded mt-2" />
        </div>
        <div className="h-9 w-28 bg-slate-200 rounded-lg" />
      </div>

      {/* Stat cards */}
      {stats > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: stats }).map((_, i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl p-4">
              <div className="h-4 w-20 bg-slate-100 rounded mb-3" />
              <div className="h-8 w-16 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      {cards ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-40 bg-white border border-slate-200 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-50 rounded-lg" />
          ))}
        </div>
      )}
    </div>
  )
}
