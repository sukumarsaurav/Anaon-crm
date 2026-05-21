import ClientForm from '@/components/clients/ClientForm'
import PageHeader from '@/components/ui/PageHeader'

export default function NewClientPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        backHref="/clients"
        title="New Client"
        subtitle="Add a post-sale client profile"
      />
      <ClientForm />
    </div>
  )
}
