export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Smartphone, MapPin, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'

interface AgentRow {
  id: string
  full_name: string
  role: string
  phone: string | null
  is_active: boolean
  today_checked_in: boolean
  today_check_in_time: string | null
  today_check_out_time: string | null
  last_location_lat: number | null
  last_location_lng: number | null
  site_visits_today: number
  leads_assigned: number
}

const AGENT_STATUS_CONFIG = {
  done:    { label: 'Done',   color: 'text-slate-600',   bg: 'bg-slate-100' },
  active:  { label: 'Active', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  absent:  { label: 'Absent', color: 'text-red-600',     bg: 'bg-red-50' },
}

function fmt(t: string | null) {
  if (!t) return '—'
  return new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export default async function MobileAdminPage() {
  const supabase = await createClient()
  const todayStr = new Date().toISOString().split('T')[0]

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role, phone, is_active')
    .in('role', ['sales_advisor', 'manager'])
    .eq('is_active', true)
    .order('full_name')

  const { data: todayAttendance } = await supabase
    .from('attendance')
    .select('user_id, check_in_time, check_out_time, check_in_lat, check_in_lng')
    .gte('check_in_time', `${todayStr}T00:00:00`)
    .lte('check_in_time', `${todayStr}T23:59:59`)

  const { data: siteVisitsToday } = await supabase
    .from('site_visits')
    .select('visited_by')
    .gte('visit_date', `${todayStr}T00:00:00`)

  const { data: leadsCount } = await supabase
    .from('leads')
    .select('assigned_to')
    .eq('is_active', true)
    .not('assigned_to', 'is', null)

  const attendanceMap = Object.fromEntries((todayAttendance ?? []).map(a => [a.user_id, a]))
  const visitsByAgent: Record<string, number> = {}
  for (const v of siteVisitsToday ?? []) {
    if (v.visited_by) visitsByAgent[v.visited_by] = (visitsByAgent[v.visited_by] ?? 0) + 1
  }
  const leadsByAgent: Record<string, number> = {}
  for (const l of leadsCount ?? []) {
    if (l.assigned_to) leadsByAgent[l.assigned_to] = (leadsByAgent[l.assigned_to] ?? 0) + 1
  }

  const agents: AgentRow[] = (profiles ?? []).map(p => {
    const att = attendanceMap[p.id]
    return {
      ...p,
      today_checked_in: !!att,
      today_check_in_time: att?.check_in_time ?? null,
      today_check_out_time: att?.check_out_time ?? null,
      last_location_lat: att?.check_in_lat ?? null,
      last_location_lng: att?.check_in_lng ?? null,
      site_visits_today: visitsByAgent[p.id] ?? 0,
      leads_assigned: leadsByAgent[p.id] ?? 0,
    }
  })

  const checkedIn = agents.filter(a => a.today_checked_in).length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <PageHeader
        title={<><Smartphone size={20} /> Mobile Team Tracker</>}
        subtitle={`Real-time field agent activity — ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <p className="text-xs text-slate-500">Total Field Agents</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{agents.length}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-slate-500">Checked In Today</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{checkedIn}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-slate-500">Not Checked In</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{agents.length - checkedIn}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-slate-500">Site Visits Today</p>
          <p className="text-2xl font-bold text-indigo-700 mt-1">
            {agents.reduce((s, a) => s + a.site_visits_today, 0)}
          </p>
        </Card>
      </div>

      {/* Agent table */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Agent</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Check In</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Check Out</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Site Visits</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Leads</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agents.map(agent => (
                <tr key={agent.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{agent.full_name}</div>
                    <div className="text-xs text-slate-400 capitalize">{agent.role.replace('_', ' ')}</div>
                    {agent.phone && <div className="text-xs text-slate-400">{agent.phone}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {agent.today_checked_in ? (
                      agent.today_check_out_time ? (
                        <StatusBadge config={AGENT_STATUS_CONFIG.done} size="sm" />
                      ) : (
                        <StatusBadge config={AGENT_STATUS_CONFIG.active} size="sm" />
                      )
                    ) : (
                      <StatusBadge config={AGENT_STATUS_CONFIG.absent} size="sm" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-sm text-slate-700">
                      <Clock size={14} className="text-slate-400" />
                      {fmt(agent.today_check_in_time)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-700">{fmt(agent.today_check_out_time)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-indigo-700">{agent.site_visits_today}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-700">{agent.leads_assigned}</span>
                  </td>
                  <td className="px-4 py-3">
                    {agent.last_location_lat ? (
                      <a
                        href={`https://maps.google.com?q=${agent.last_location_lat},${agent.last_location_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                      >
                        <MapPin size={14} /> View
                      </a>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
