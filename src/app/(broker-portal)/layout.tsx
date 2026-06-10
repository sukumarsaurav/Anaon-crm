import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/getProfile'
import { getBrokerByAuthUser } from '@/lib/brokers/queries'
import BrokerNav from '@/components/broker-portal/BrokerNav'

export default async function BrokerPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getProfile()

  if (!session?.user) redirect('/login')

  const { user, profile } = session

  // Non-brokers don't belong here
  if (profile?.role !== 'broker') redirect('/leads')

  const broker = await getBrokerByAuthUser(user.id)
  if (!broker) redirect('/login')

  return (
    <div className="flex h-screen bg-slate-50">
      <BrokerNav brokerName={broker.full_name} firmName={broker.firm_name} />
      <main className="ml-60 flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
