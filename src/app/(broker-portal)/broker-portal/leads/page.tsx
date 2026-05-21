export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBrokerByAuthUser, getBrokerLeadRegistrations } from '@/lib/brokers/queries'
import BrokerLeadForm from '@/components/broker-portal/BrokerLeadForm'
import { formatDate } from '@/lib/utils'
import { LEAD_REG_STATUS_CONFIG } from '@/types/brokers'

export default async function BrokerLeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const broker = await getBrokerByAuthUser(user.id)
  if (!broker) redirect('/login')

  const [leads, { data: projects }] = await Promise.all([
    getBrokerLeadRegistrations(broker.id),
    supabase.from('projects').select('id, name, city').eq('is_active', true).order('name'),
  ])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Leads</h1>
        <p className="text-sm text-slate-500 mt-1">Register new leads and track their progress</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">How lead registration works</p>
        <ul className="space-y-0.5 list-disc list-inside text-blue-600">
          <li>Register a lead with the client's name and phone number</li>
          <li>ANON INDIA assigns an advisor internally — you will not see advisor details</li>
          <li>You receive stage updates as the lead progresses</li>
          <li>If a phone number already exists in our system, it is marked as duplicate — FIFO commission rules apply</li>
        </ul>
      </div>

      <BrokerLeadForm projects={projects ?? []} />

      {/* Lead history */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Registered Leads</h3>
          <span className="text-xs text-slate-400">{leads.length} total</span>
        </div>
        {leads.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No leads registered yet. Use the form above to register your first lead.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100">
              <tr className="text-xs text-slate-500">
                <th className="pb-2 text-left">Client</th>
                <th className="pb-2 text-left">Phone</th>
                <th className="pb-2 text-left">Project</th>
                <th className="pb-2 text-left">Registered</th>
                <th className="pb-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const cfg = LEAD_REG_STATUS_CONFIG[l.status]
                return (
                  <tr key={l.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 font-medium text-slate-900">{l.client_name}</td>
                    <td className="py-2.5 text-slate-500">{l.client_phone}</td>
                    <td className="py-2.5 text-slate-500">{l.project?.name ?? '—'}</td>
                    <td className="py-2.5 text-slate-400">{formatDate(l.created_at)}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg}`}>
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
