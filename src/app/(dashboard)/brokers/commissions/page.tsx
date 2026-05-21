export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getBrokerCommissions } from '@/lib/brokers/queries'
import { formatCurrency } from '@/lib/utils'
import CommissionBatchPanel from '@/components/brokers/CommissionBatchPanel'
import { ArrowLeft, DollarSign, Clock, CheckCircle } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function CommissionsPage({ searchParams }: PageProps) {
  const sp = await searchParams

  const [
    { commissions: all },
    { commissions: pending },
    { commissions: approved },
  ] = await Promise.all([
    getBrokerCommissions({ status: sp.status, limit: 100 }),
    getBrokerCommissions({ status: 'pending', limit: 200 }),
    getBrokerCommissions({ status: 'approved', limit: 200 }),
  ])

  const pendingTotal  = pending.reduce((a, c)  => a + (c.commission_amount ?? 0), 0)
  const approvedTotal = approved.reduce((a, c) => a + (c.commission_amount ?? 0), 0)

  const stats = [
    { label: 'Pending Approval', value: formatCurrency(pendingTotal),  count: pending.length,  icon: Clock,       color: 'text-amber-600', bg: 'bg-amber-50'  },
    { label: 'Approved / Ready', value: formatCurrency(approvedTotal), count: approved.length, icon: CheckCircle, color: 'text-blue-600',  bg: 'bg-blue-50'   },
    { label: 'Total Liability',  value: formatCurrency(pendingTotal + approvedTotal), count: pending.length + approved.length, icon: DollarSign, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ]

  const statusTabs = [
    { label: 'All',      value: undefined    },
    { label: 'Pending',  value: 'pending'    },
    { label: 'Approved', value: 'approved'   },
    { label: 'Paid',     value: 'paid'       },
    { label: 'Voided',   value: 'voided'     },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/brokers" className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Commission Management</h1>
          <p className="text-sm text-slate-500">Review, approve, and process broker commissions</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ label, value, count, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${bg}`}><Icon size={20} className={color} /></div>
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-400">{count} commission{count !== 1 ? 's' : ''}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {statusTabs.map((t) => {
          const active = (sp.status ?? undefined) === t.value
          const href = t.value ? `?status=${t.value}` : '?'
          return (
            <Link key={t.label} href={href}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${active ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
              {t.label}
            </Link>
          )
        })}
      </div>

      <CommissionBatchPanel commissions={all} />
    </div>
  )
}
