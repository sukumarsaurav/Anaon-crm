export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getBrokers, getTopBrokers } from '@/lib/brokers/queries'
import { formatCurrency } from '@/lib/utils'
import BrokerStatusBadge from '@/components/brokers/BrokerStatusBadge'
import { Plus, TrendingUp, Users, DollarSign, CheckCircle } from 'lucide-react'
import type { BrokerStatus } from '@/types/brokers'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface PageProps {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>
}

export default async function BrokersPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const page   = parseInt(sp.page ?? '1')
  const limit  = 20
  const offset = (page - 1) * limit

  const [{ brokers, total }, topBrokers] = await Promise.all([
    getBrokers({ status: sp.status, search: sp.search, limit, offset }),
    getTopBrokers(5),
  ])

  const totalPages = Math.ceil(total / limit)

  const statusTabs: { label: string; value: string | undefined }[] = [
    { label: 'All',      value: undefined     },
    { label: 'Pending',  value: 'pending'     },
    { label: 'Approved', value: 'approved'    },
    { label: 'Inactive', value: 'inactive'    },
    { label: 'Rejected', value: 'rejected'    },
  ]

  const stats = [
    { label: 'Total Brokers',  value: total,                                    icon: Users,       color: 'text-blue-600',   bg: 'bg-blue-50'  },
    { label: 'Approved',       value: topBrokers.length,                        icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-50' },
    { label: 'Top Commission', value: topBrokers[0] ? `${topBrokers[0].commission_rate}%` : '—', icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Total Earned',   value: formatCurrency(topBrokers.reduce((a, b) => a + b.total_commission_earned, 0)), icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50' },
  ]

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Channel Partners"
        subtitle="Manage brokers, registrations, and commissions"
        actions={
          <>
            <Button href="/brokers/commissions" variant="secondary">
              <DollarSign size={16} /> Commissions
            </Button>
            <Button href="/brokers/new">
              <Plus size={16} /> Add Broker
            </Button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} padding="sm" className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${bg}`}><Icon size={18} className={color} /></div>
            <div><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-bold text-slate-900">{value}</p></div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {statusTabs.map((t) => {
            const active = (sp.status ?? undefined) === t.value
            const params = new URLSearchParams()
            if (t.value) params.set('status', t.value)
            if (sp.search) params.set('search', sp.search)
            const href = `?${params.toString()}`
            return (
              <Link key={t.label} href={href}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${active ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                {t.label}
              </Link>
            )
          })}
        </div>
        <form method="GET" className="flex-1 max-w-xs">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <input name="search" defaultValue={sp.search} placeholder="Search brokers..."
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
        </form>
      </div>

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Broker</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">City</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">RERA</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Commission %</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {brokers.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No brokers found</td></tr>
            )}
            {brokers.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{b.full_name}</p>
                  <p className="text-xs text-slate-400">{b.firm_name ?? b.email ?? b.phone}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{b.city ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600 font-mono text-xs">{b.rera_number ?? '—'}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">{b.commission_rate}%</td>
                <td className="px-4 py-3"><BrokerStatusBadge status={b.status as BrokerStatus} /></td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/brokers/${b.id}`} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">View →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={`?page=${p}${sp.status ? `&status=${sp.status}` : ''}${sp.search ? `&search=${sp.search}` : ''}`}
              className={`px-3 py-1.5 text-sm rounded-lg border ${p === page ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 hover:border-indigo-300 text-slate-700'}`}>
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
