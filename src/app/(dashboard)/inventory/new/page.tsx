import ProjectForm from '@/components/inventory/ProjectForm'
import PageHeader from '@/components/ui/PageHeader'

export default function NewProjectPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="New Project"
        subtitle="Add a new real estate project to inventory"
        backHref="/inventory"
      />

      <ProjectForm />
    </div>
  )
}
