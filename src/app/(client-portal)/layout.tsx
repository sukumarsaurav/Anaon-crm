import { redirect } from 'next/navigation'
import { getPortalSession } from '@/lib/portal/session'
import ClientPortalNav from '@/components/client-portal/ClientPortalNav'

export default async function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSession()
  if (!session) redirect('/client-portal/login')

  const { client } = session

  return (
    <div className="min-h-screen bg-slate-50">
      <ClientPortalNav
        clientName={client.full_name}
      />
      <main className="md:ml-60 pb-20 md:pb-0">
        {children}
      </main>
    </div>
  )
}
