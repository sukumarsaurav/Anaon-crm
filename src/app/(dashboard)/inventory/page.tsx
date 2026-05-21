export const dynamic = 'force-dynamic'

import { getProjects } from '@/lib/inventory/queries'
import { getProjectStats } from '@/lib/inventory/queries'
import ProjectCard from '@/components/inventory/ProjectCard'
import { PROJECT_STATUS_CONFIG, PROJECT_TYPE_LABELS } from '@/types/inventory'
import { Plus, Building2 } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'

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

  // Fetch stats for all projects in parallel
  const statsArr = await Promise.all(projects.map((p) => getProjectStats(p.id)))
  const statsMap = Object.fromEntries(projects.map((p, i) => [p.id, statsArr[i]]))

  const statuses = Object.entries(PROJECT_STATUS_CONFIG)
  const types    = Object.entries(PROJECT_TYPE_LABELS)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Inventory"
        subtitle={`${projects.length} project${projects.length !== 1 ? 's' : ''}`}
        actions={
          <Button href="/inventory/new">
            <Plus size={16} /> New Project
          </Button>
        }
      />

      {/* Filters */}
      <Card padding="none" className="px-4 py-3">
        <form method="get" className="flex flex-wrap gap-3 w-full">
          <input
            name="search"
            defaultValue={params.search}
            placeholder="Search projects..."
            className="flex-1 min-w-40 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select name="status" defaultValue={params.status ?? ''}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Statuses</option>
            {statuses.map(([v, cfg]) => (
              <option key={v} value={v}>{cfg.label}</option>
            ))}
          </select>
          <select name="type" defaultValue={params.type ?? ''}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
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
