import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { PROJECT_TYPE_LABELS } from '@/types/inventory'
import ProjectStatusBadge from './ProjectStatusBadge'
import type { Project, ProjectStats } from '@/types/inventory'

interface Props {
  project: Project
  stats: ProjectStats
}

export default function ProjectCard({ project, stats }: Props) {
  const soldPct = stats.total > 0 ? Math.round(((stats.booked + stats.registered + stats.sold) / stats.total) * 100) : 0

  return (
    <Link href={`/inventory/${project.id}`} className="block bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      {/* Layout image or placeholder */}
      <div className="h-36 bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center relative">
        {project.layout_image_url ? (
          <img src={project.layout_image_url} alt={project.name} className="w-full h-full object-cover" />
        ) : (
          <Building2 size={36} className="text-indigo-300" />
        )}
        <div className="absolute top-2 right-2">
          <ProjectStatusBadge status={project.status} />
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-slate-900 text-sm leading-tight">{project.name}</h3>
          <span className="text-xs text-slate-500 flex-shrink-0">{PROJECT_TYPE_LABELS[project.type]}</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">{project.city}{project.locality ? `, ${project.locality}` : ''}</p>

        {/* Inventory stats */}
        <div className="grid grid-cols-4 gap-1 text-center mb-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-slate-700' },
            { label: 'Available', value: stats.available, color: 'text-green-600' },
            { label: 'Held', value: stats.soft_hold, color: 'text-amber-600' },
            { label: 'Sold', value: stats.booked + stats.registered + stats.sold, color: 'text-red-600' },
          ].map((s) => (
            <div key={s.label}>
              <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
          <div
            className="bg-indigo-500 h-1.5 rounded-full transition-all"
            style={{ width: `${soldPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>{soldPct}% sold</span>
          <span>{formatCurrency(stats.revenue_booked)} booked</span>
        </div>

        {project.rera_number && (
          <p className="text-xs text-slate-400 mt-2">RERA: {project.rera_number}</p>
        )}
      </div>
    </Link>
  )
}
