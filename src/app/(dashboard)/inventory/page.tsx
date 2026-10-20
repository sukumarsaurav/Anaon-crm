export const dynamic = 'force-dynamic'

import { getProjects, getProjectStatsBulk } from '@/lib/inventory/queries'
import ProjectCard from '@/components/inventory/ProjectCard'
import { PROJECT_STATUS_CONFIG, PROJECT_TYPE_LABELS } from '@/types/inventory'
import { Plus, Building2 } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { formatDateTime } from '@/lib/utils'

export const metadata = { title: 'Inventory' }

interface PageProps {
  searchParams: Promise<{ status?: string; type?: string; search?: string }>
}

export default async function InventoryPage({ searchParams }: PageProps) {
  const params = await searchParams
  const projects = await getProjects({
    status: params.status,
    type:   params.type,
    search: params.search,
  })

  // Stats for every project in one query, not one query per project.
  const statsMap = await getProjectStatsBulk(projects.map((p) => p.id))

  // The plots this user is holding, so a hold isn't forgotten until it lapses.
  const session = await getProfile()
  const canManage = ['admin', 'manager'].includes(session?.profile?.role ?? '')
  const { data: myHolds } = session?.user
    ? await (await createClient()).from('plots')
        .select('id, plot_number, project_id, held_until, project:projects(name)')
        .eq('held_by', session.user.id).eq('status', 'soft_hold').order('held_until', { ascending: true })
    : { data: [] }

  const statuses = Object.entries(PROJECT_STATUS_CONFIG)
  const types    = Object.entries(PROJECT_TYPE_LABELS)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Inventory"
        subtitle={`${projects.length} project${projects.length !== 1 ? 's' : ''}`}
        actions={
          canManage && <Button href="/inventory/new">
            <Plus size={16} /> New Project
          </Button>
        }
      />

      {(myHolds ?? []).length > 0 && (
        <Card padding="md">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">My holds ({myHolds!.length})</h2>
          <ul className="divide-y divide-slate-100">
            {myHolds!.map((h) => {
              const project = (Array.isArray(h.project) ? h.project[0] : h.project) as { name?: string } | null
              return (
                <li key={h.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/inventory/${h.project_id}`} className="text-primary-600 hover:underline">
                    {project?.name ?? 'Project'} · Plot {h.plot_number}
                  </Link>
                  <span className="text-xs text-slate-500">{h.held_until ? `Expires ${formatDateTime(h.held_until)}` : 'Held for a booking'}</span>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {/* Filters */}
      <Card padding="none" className="px-4 py-3">
        <form method="get" className="flex flex-wrap gap-3 w-full">
          <input aria-label="Search projects..."
            name="search"
            defaultValue={params.search}
            placeholder="Search projects..."
            className="flex-1 min-w-40 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <select aria-label="Status" name="status" defaultValue={params.status ?? ''}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Statuses</option>
            {statuses.map(([v, cfg]) => (
              <option key={v} value={v}>{cfg.label}</option>
            ))}
          </select>
          <select aria-label="Project type" name="type" defaultValue={params.type ?? ''}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Types</option>
            {types.map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
          <Button type="submit" size="sm">Filter</Button>
          {(params.status || params.type || params.search) && (
            <Button href="/inventory" variant="secondary" size="sm">
              Clear
            </Button>
          )}
        </form>
      </Card>

      {/* Grid */}
      {projects.length === 0 ? (
        <EmptyState
          icon={<Building2 size={40} />}
          title="No projects found"
          description="Create your first project to get started"
          action={
            <Button href="/inventory/new">
              <Plus size={16} /> New Project
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} stats={statsMap[project.id]} />
          ))}
        </div>
      )}
    </div>
  )
}
