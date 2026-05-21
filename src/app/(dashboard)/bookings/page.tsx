export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getBookings, getBookingStats } from '@/lib/bookings/queries'
import BookingCard from '@/components/bookings/BookingCard'
import BookingStatsBar from '@/components/bookings/BookingStatsBar'
import { BOOKING_STATUS_CONFIG } from '@/types/bookings'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { Plus, BookOpen } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>
}

const PAGE_SIZE = 18

export default async function BookingsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page   = parseInt(params.page ?? '1')
  const offset = (page - 1) * PAGE_SIZE

  const [{ bookings, total }, stats] = await Promise.all([
    getBookings({ status: params.status, search: params.search, limit: PAGE_SIZE, offset }),
    getBookingStats(),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Bookings"
        subtitle={`${total} result${total !== 1 ? 's' : ''}`}
        actions={
          <Button href="/bookings/new">
            <Plus size={16} /> New Booking
          </Button>
        }
      />

      <BookingStatsBar stats={stats} />

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
        <form method="get" className="flex flex-wrap gap-3">
          <input name="search" defaultValue={params.search}
            placeholder="Search client name..."
            className="flex-1 min-w-44 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500" />
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
            <Link href="/bookings"
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                !params.status ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>All</Link>
            {Object.entries(BOOKING_STATUS_CONFIG).map(([v, cfg]) => (
              <Link key={v} href={`/bookings?status=${v}`}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  params.status === v ? `bg-white ${cfg.color} shadow-sm` : 'text-slate-500 hover:text-slate-700'
                }`}>{cfg.label}</Link>
            ))}
          </div>
          <Button type="submit" size="sm">Search</Button>
        </form>
      </div>

      {/* Grid */}
      {bookings.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={40} />}
          title="No bookings found"
          action={
            <Button href="/bookings/new">
              <Plus size={16} /> Create First Booking
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bookings.map((b) => <BookingCard key={b.id} booking={b} />)}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {page > 1 && (
                <Button
                  href={`/bookings?${new URLSearchParams({ ...params, page: String(page - 1) })}`}
                  variant="secondary"
                  size="sm"
                >
                  Previous
                </Button>
              )}
              <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
              {page < totalPages && (
                <Button
                  href={`/bookings?${new URLSearchParams({ ...params, page: String(page + 1) })}`}
                  variant="secondary"
                  size="sm"
                >
                  Next
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
