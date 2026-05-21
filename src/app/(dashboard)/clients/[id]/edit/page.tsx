export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getClientById } from '@/lib/clients/queries'
import ClientForm from '@/components/clients/ClientForm'
import PageHeader from '@/components/ui/PageHeader'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditClientPage({ params }: PageProps) {
  const { id } = await params
  const client = await getClientById(id)
  if (!client) notFound()

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        backHref={`/clients/${id}`}
        title="Edit Client"
        subtitle={client.full_name}
      />
      <ClientForm client={client} />
    </div>
  )
}
