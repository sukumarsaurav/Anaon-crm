export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import {
  getProjectById, getProjectStats, getPlots,
  getProjectDocuments, getPriceEscalations,
} from '@/lib/inventory/queries'
import { getProfile } from '@/lib/supabase/getProfile'
import ProjectStatusBadge from '@/components/inventory/ProjectStatusBadge'
import PlotGrid from '@/components/inventory/PlotGrid'
import ProjectDocumentList from '@/components/inventory/ProjectDocumentList'
import PriceEscalationPanel from '@/components/inventory/PriceEscalationPanel'
import { PROJECT_TYPE_LABELS } from '@/types/inventory'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Edit, Plus, LayoutGrid, MapPin, ExternalLink } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params

  const [project, stats, plots, documents, escalations] = await Promise.all([
    getProjectById(id),
    getProjectStats(id),
    getPlots(id),
    getProjectDocuments(id),
    getPriceEscalations(id),
  ])

  if (!project) notFound()

  const profile = (await getProfile())?.profile
  const canManage = ['admin', 'manager'].includes(profile?.role ?? '')

  const soldPct = stats.total > 0
    ? Math.round(((stats.booked + stats.registered + stats.sold) / stats.total) * 100)
    : 0

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={
          <>
            {project.name}
            <ProjectStatusBadge status={project.status} />
          </>
        }
        subtitle={`${PROJECT_TYPE_LABELS[project.type]} · ${project.city}${project.locality ? `, ${project.locality}` : ''}`}
        backHref="/inventory"
        actions={
          canManage ? (
            <>
              <Button href={`/inventory/${id}/plots/new`} variant="secondary">
                <Plus size={16} /> Add Plots
              </Button>
              <Button href={`/inventory/${id}/edit`}>
                <Edit size={16} /> Edit
              </Button>
            </>
          ) : undefined
        }
      />

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',       value: stats.total,        color: 'text-slate-800' },
          { label: 'Available',   value: stats.available,    color: 'text-green-600' },
          { label: 'Soft Hold',   value: stats.soft_hold,    color: 'text-amber-600' },
          { label: 'Booked',      value: stats.booked,       color: 'text-red-600' },
          { label: 'Registered',  value: stats.registered,   color: 'text-red-700' },
          { label: 'Sold',        value: stats.sold,         color: 'text-slate-600' },
          { label: 'Not for Sale',value: stats.not_for_sale, color: 'text-slate-400' },
        ].map((s) => (
          <Card key={s.label} padding="sm" className="text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Revenue + quick info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card padding="md" className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Revenue Overview</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-slate-500">Revenue Potential (Available)</p>
              <p className="text-xl font-bold text-slate-800">{formatCurrency(stats.revenue_potential)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Revenue Booked</p>
              <p className="text-xl font-bold text-indigo-700">{formatCurrency(stats.revenue_booked)}</p>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Sold / Booked</span>
              <span>{soldPct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${soldPct}%` }} />
            </div>
          </div>
        </Card>

        <Card padding="md" className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Project Info</h3>
          {project.rera_number && (
            <p className="text-sm text-slate-600"><span className="font-medium text-slate-700">RERA:</span> {project.rera_number}</p>
          )}
          {project.launch_date && (
            <p className="text-sm text-slate-600"><span className="font-medium text-slate-700">Launch:</span> {formatDate(project.launch_date)}</p>
          )}
          {project.expected_completion_date && (
            <p className="text-sm text-slate-600"><span className="font-medium text-slate-700">Completion:</span> {formatDate(project.expected_completion_date)}</p>
          )}
          {project.total_units && (
            <p className="text-sm text-slate-600"><span className="font-medium text-slate-700">Total Units:</span> {project.total_units}</p>
          )}
          {project.google_maps_pin && (
            <a href={project.google_maps_pin} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700">
              <MapPin size={14} /> View on Maps <ExternalLink size={14} />
            </a>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {project.brochure_url && (
              <a href={project.brochure_url} target="_blank" rel="noopener noreferrer"
                className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100">Brochure</a>
            )}
            {project.price_list_url && (
              <a href={project.price_list_url} target="_blank" rel="noopener noreferrer"
                className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100">Price List</a>
            )}
            {project.video_url && (
              <a href={project.video_url} target="_blank" rel="noopener noreferrer"
                className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100">Video Tour</a>
            )}
          </div>
        </Card>
      </div>

      {/* Amenities */}
      {project.amenities?.length > 0 && (
        <Card padding="md">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Amenities</h3>
          <div className="flex flex-wrap gap-2">
            {project.amenities.map((a) => (
              <span key={a} className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full">{a}</span>
            ))}
          </div>
        </Card>
      )}

      {/* Plot Grid */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <LayoutGrid size={18} className="text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">Plot Map ({plots.length} plots)</h2>
        </div>
        <PlotGrid plots={plots} projectId={id} canManage={canManage} />
      </div>

      {/* Documents + Escalations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ProjectDocumentList projectId={id} documents={documents} canManage={canManage} />
        <PriceEscalationPanel projectId={id} escalations={escalations} canManage={canManage} />
      </div>
    </div>
  )
}
