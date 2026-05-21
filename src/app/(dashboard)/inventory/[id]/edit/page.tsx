export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getProjectById } from '@/lib/inventory/queries'
import ProjectForm from '@/components/inventory/ProjectForm'
import PageHeader from '@/components/ui/PageHeader'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditProjectPage({ params }: PageProps) {
  const { id } = await params
  const project = await getProjectById(id)
  if (!project) notFound()

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Edit Project"
        subtitle={project.name}
        backHref={`/inventory/${id}`}
      />

      <ProjectForm project={project} />
    </div>
  )
}
