import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, LayoutList, Kanban, AlertTriangle, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { getLeads, getLeadsPage, getLeadStats, getActiveAdvisors } from '@/lib/leads/queries'
import type { Lead, LeadFilters, LeadStage, LeadSource, LeadTemperature } from '@/types/leads'
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
  const page = Math.max(1, parseInt((params.page as string) || '1', 10) || 1)
  const PAGE_SIZE = 50

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

  const profileData = await getProfile()
  if (!profileData || !profileData.user) return null
  const { user, profile } = profileData

  const [leadsResult, stats, advisors] = await Promise.all([
    isKanban ? getLeads(filters) : getLeadsPage(filters, page, PAGE_SIZE),
    getLeadStats(user.id, profile?.role ?? 'sales_advisor', profile?.branch_id ?? undefined),
    getActiveAdvisors(profile?.branch_id ?? undefined),
  ])

  const leads: Lead[] = isKanban ? (leadsResult as Lead[]) : (leadsResult as { leads: Lead[] }).leads
  const totalLeads = isKanban ? leads.length : (leadsResult as { count: number }).count
  const totalPages = Math.max(1, Math.ceil(totalLeads / PAGE_SIZE))

  // Build a querystring that preserves filters while changing the page.
  const pageHref = (p: number) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (k === 'page' || v == null) continue
      if (Array.isArray(v)) v.forEach((x) => sp.append(k, x))
      else sp.set(k, v as string)
    }
    sp.set('page', String(p))
    return `/leads?${sp.toString()}`
  }

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
                  !isKanban ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <LayoutList size={16} />
                Table
              </Link>
              <Link
                href={`/leads?view_mode=kanban`}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                  isKanban ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Kanban size={16} />
                Kanban
              </Link>
            </div>
            {(profile?.role === 'admin' || profile?.role === 'manager') && (
              <>
                <Button href="/leads/overdue" variant="secondary">
                  <AlertTriangle size={16} />
                  Overdue
                </Button>
                <Button href="/leads/import" variant="secondary">
                  <Upload size={16} />
                  Import CSV
                </Button>
              </>
            )}
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
          <>
            <LeadsTable leads={leads} advisors={advisors} />
            {totalLeads > 0 && (
              <div className="flex items-center justify-between mt-4 text-sm">
                <p className="text-slate-500">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalLeads)} of {totalLeads}
                </p>
                <div className="flex items-center gap-2">
                  {page > 1 ? (
                    <Link href={pageHref(page - 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700">Previous</Link>
                  ) : (
                    <span className="px-3 py-1.5 rounded-lg border border-slate-100 text-slate-300 cursor-not-allowed">Previous</span>
                  )}
                  <span className="text-slate-500">Page {page} of {totalPages}</span>
                  {page < totalPages ? (
                    <Link href={pageHref(page + 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700">Next</Link>
                  ) : (
                    <span className="px-3 py-1.5 rounded-lg border border-slate-100 text-slate-300 cursor-not-allowed">Next</span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </Suspense>
    </div>
  )
}
