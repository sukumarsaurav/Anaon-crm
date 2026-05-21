export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getBrokerById } from '@/lib/brokers/queries'
import { createClient } from '@/lib/supabase/server'
import BrokerForm from '@/components/brokers/BrokerForm'
import { ArrowLeft } from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditBrokerPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (!['admin', 'manager'].includes(profile?.role ?? '')) redirect(`/brokers/${id}`)

  const broker = await getBrokerById(id)
  if (!broker) notFound()

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/brokers/${id}`} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Edit Broker</h1>
          <p className="text-sm text-slate-500">{broker.full_name}</p>
        </div>
      </div>
      <BrokerForm broker={broker} />
    </div>
  )
}
