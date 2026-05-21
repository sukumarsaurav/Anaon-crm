export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getProjectById } from '@/lib/inventory/queries'
import PlotForm from '@/components/inventory/PlotForm'
import BulkPlotForm from '@/components/inventory/BulkPlotForm'
import PageHeader from '@/components/ui/PageHeader'

interface PageProps {
  params:      Promise<{ id: string }>
  searchParams: Promise<{ mode?: string }>
}

export default async function NewPlotPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { mode } = await searchParams

  const project = await getProjectById(id)
  if (!project) notFound()

  const isBulk = mode === 'bulk'

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Add Plots"
        subtitle={project.name}
        backHref={`/inventory/${id}`}
      />

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <Link href={`/inventory/${id}/plots/new`}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            !isBulk ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          Single Plot
        </Link>
        <Link href={`/inventory/${id}/plots/new?mode=bulk`}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            isBulk ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          Bulk Create
        </Link>
      </div>

      {isBulk ? (
        <BulkPlotForm projectId={id} />
      ) : (
        <PlotForm projectId={id} />
      )}
    </div>
  )
}
