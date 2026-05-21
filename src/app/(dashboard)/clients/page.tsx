export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getClients } from '@/lib/clients/queries'
import { createClient as createSupabase } from '@/lib/supabase/server'
import ClientCard from '@/components/clients/ClientCard'
import { KYC_STATUS_CONFIG } from '@/types/clients'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { Plus, Users } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ search?: string; kyc_status?: string; project_id?: string; page?: string }>
}

const PAGE_SIZE = 24

export default async function ClientsPage({ searchParams }: PageProps) {
  const params  = await searchParams
  const page    = parseInt(params.page ?? '1')
  const offset  = (page - 1) * PAGE_SIZE

  const { clients, total } = await getClients({
    search:     params.search,
    kyc_status: params.kyc_status,
    project_id: params.project_id,
    limit:      PAGE_SIZE,
    offset,
  })

  // Get booking counts per client
  const supabase = await createSupabase()
  const { data: bookingCounts } = await supabase
    .from('bookings')
    .select('client_id')
    .in('client_id', clients.map((c) => c.id))

  const countMap: Record<string, number> = {}
  for (const b of bookingCounts ?? []) {
    countMap[b.client_id] = (countMap[b.client_id] ?? 0) + 1
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Clients"
        subtitle={`${total} total client${total !== 1 ? 's' : ''}`}
        actions={
          <Button href="/clients/new">
            <Plus size={16} /> New Client
          </Button>
        }
      />

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
        <form method="get" className="flex flex-wrap gap-3">
          <input
            name="search"
            defaultValue={params.search}
            placeholder="Search name, phone, email..."
            className="flex-1 min-w-48 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
          />
          <select name="kyc_status" defaultValue={params.kyc_status ?? ''}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500">
            <option value="">All KYC Status</option>
            {Object.entries(KYC_STATUS_CONFIG).map(([v, cfg]) => (
              <option key={v} value={v}>{cfg.label}</option>
            ))}
          </select>
          <Button type="submit" size="sm">Filter</Button>
          {(params.search || params.kyc_status) && (
            <Button href="/clients" variant="secondary" size="sm">Clear</Button>
          )}
        </form>
      </div>

      {/* Grid */}
      {clients.length === 0 ? (
        <EmptyState
          icon={<Users size={40} />}
          title="No clients found"
          description="Clients are created when leads are converted to bookings"
          action={
            <Button href="/clients/new">
              <Plus size={16} /> Add Client Manually
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {clients.map((client) => (
              <ClientCard key={client.id} client={client} bookingCount={countMap[client.id] ?? 0} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              {page > 1 && (
                <Button
                  href={`/clients?${new URLSearchParams({ ...params, page: String(page - 1) })}`}
                  variant="secondary"
                  size="sm"
                >
                  Previous
                </Button>
              )}
              <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
              {page < totalPages && (
                <Button
                  href={`/clients?${new URLSearchParams({ ...params, page: String(page + 1) })}`}
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
