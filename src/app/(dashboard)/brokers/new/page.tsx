export const dynamic = 'force-dynamic'

import BrokerForm from '@/components/brokers/BrokerForm'
import PageHeader from '@/components/ui/PageHeader'

export default function NewBrokerPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Add Channel Partner"
        subtitle="Register a new broker or referral agent"
        backHref="/brokers"
      />
      <BrokerForm />
    </div>
  )
}
