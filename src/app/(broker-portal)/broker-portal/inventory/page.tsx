export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/getProfile'
import { getBrokerByAuthUser, getPortalAvailablePlots } from '@/lib/brokers/queries'
import { formatCurrency } from '@/lib/utils'
import { Building2 } from 'lucide-react'

export default async function BrokerInventoryPage() {
  const user = (await getProfile())?.user
  if (!user) redirect('/login')

  const broker = await getBrokerByAuthUser(user.id)
  if (!broker) redirect('/login')

  const plots = await getPortalAvailablePlots()

  type PlotWithProject = typeof plots[number] & {
    project?: { id: string; name: string; city: string; type: string } | null
  }
  // Group by project
  const byProject = plots.reduce<Record<string, { project: { id: string; name: string; city: string; type: string } | null; plots: PlotWithProject[] }>>((acc, p) => {
    const proj = (p as unknown as PlotWithProject).project
    const key  = proj?.id ?? 'unknown'
    if (!acc[key]) acc[key] = { project: proj ?? null, plots: [] }
    acc[key].plots.push(p as unknown as PlotWithProject)
    return acc
  }, {})

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Available Inventory</h1>
        <p className="text-sm text-slate-500 mt-1">{plots.length} plots currently available across all projects</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        Showing only <strong>available</strong> plots. Pricing and client details are managed internally by ANON INDIA. Contact your relationship manager for detailed pricing and cost sheets.
      </div>

      {Object.values(byProject).length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-40" />
          <p>No available plots at this time</p>
        </div>
      ) : (
        Object.values(byProject).map(({ project, plots: projectPlots }) => (
          <div key={project?.id ?? 'unknown'} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-semibold text-slate-900">{project?.name ?? 'Unknown Project'}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{project?.city} · {project?.type?.replace('_', ' ')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-slate-100">
              {projectPlots.map((plot) => {
                const p = plot as {
                  id: string; plot_number: string; type: string;
                  size_sqyd: number | null; size_sqft: number | null;
                  facing: string | null; base_price: number; total_price: number | null
                }
                return (
                  <div key={p.id} className="bg-white p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-900">Plot {p.plot_number}</span>
                      <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-200">Available</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-1">
                      {p.type?.replace('_', ' ')}
                      {p.facing && ` · ${p.facing.replace('_', '-').toUpperCase()}`}
                    </p>
                    <p className="text-xs text-slate-500 mb-2">
                      {p.size_sqyd ? `${p.size_sqyd} sq yd` : p.size_sqft ? `${p.size_sqft} sq ft` : 'Size TBD'}
                    </p>
                    <p className="text-sm font-bold text-indigo-700">{formatCurrency(p.total_price ?? p.base_price)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
