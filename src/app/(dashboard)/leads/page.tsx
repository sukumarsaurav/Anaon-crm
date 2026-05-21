import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, LayoutList, Kanban } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getLeads, getLeadStats, getActiveAdvisors } from '@/lib/leads/queries'
import type { LeadFilters, LeadStage, LeadSource, LeadTemperature } from '@/types/leads'
import LeadsStats from '@/components/leads/LeadsStats'
import LeadFiltersBar from '@/components/leads/LeadFilters'
import LeadsTable from '@/components/leads/LeadsTable'
import LeadsKanban from '@/components/leads/LeadsKanban'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import { PageLoader } from '@/components/ui/Spinner'

interface LeadsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function parseArrayParam(value: string | string[] | undefined): string[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = await searchParams
  const view = (params.view as string) || 'all'
  const isKanban = params.view_mode === 'kanban'

  const filters: LeadFilters = {
    view: view as LeadFilters['view'],
    stage: parseArrayParam(params.stage) as LeadStage[],
    source: parseArrayParam(params.source) as LeadSource[],
    temperature: parseArrayParam(params.temperature) as LeadTemperature[],
    assigned_to: params.assigned_to as string | undefined,
    project_id: params.project_id as string | undefined,
    city: params.city as string | undefined,
    search: params.search as string | undefined,
    sort_by: (params.sort_by as string) || 'created_at',
    sort_dir: (params.sort_dir as 'asc' | 'desc') || 'desc',
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()

  const [leads, stats, advisors] = await Promise.all([
    getLeads(filters),
    getLeadStats(user.id, profile?.role ?? 'sales_advisor', profile?.branch_id ?? undefined),
    getActiveAdvisors(profile?.branch_id ?? undefined),
  ])

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Leads"
        subtitle="Manage and track all your leads in one place"
        actions={
          <>
            {/* View toggle */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
              <Link
                href={`/leads?view_mode=list`}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                  !isKanban ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <LayoutList size={16} />
                Table
              </Link>
              <Link
                href={`/leads?view_mode=kanban`}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                  isKanban ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Kanban size={16} />
                Kanban
              </Link>
            </div>
            <Button href="/leads/new">
              <Plus size={16} />
              Add Lead
            </Button>
          </>
        }
      />

      {/* Stats */}
      <LeadsStats stats={stats} />

      {/* Filters */}
      <Suspense fallback={null}>
        <LeadFiltersBar />
      </Suspense>

      {/* Leads view */}
      <Suspense fallback={<PageLoader />}>
        {isKanban ? (
          <LeadsKanban leads={leads} />
        ) : (
          <LeadsTable leads={leads} advisors={advisors} />
        )}
      </Suspense>
    </div>
  )
}
