import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBrokerByAuthUser } from '@/lib/brokers/queries'
import BrokerNav from '@/components/broker-portal/BrokerNav'

export default async function BrokerPortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

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
