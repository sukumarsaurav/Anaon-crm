export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getPlotById, getProjectById } from '@/lib/inventory/queries'
import PlotForm from '@/components/inventory/PlotForm'
import PageHeader from '@/components/ui/PageHeader'

interface PageProps {
  params: Promise<{ id: string; plotId: string }>
}

export default async function EditPlotPage({ params }: PageProps) {
  const { id, plotId } = await params

  const [project, plot] = await Promise.all([
    getProjectById(id),
    getPlotById(plotId),
  ])

  if (!project || !plot) notFound()

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title={`Edit Plot ${plot.plot_number}`}
        subtitle={project.name}
        backHref={`/inventory/${id}`}
      />

      <PlotForm projectId={id} plot={plot} />
    </div>
  )
}
