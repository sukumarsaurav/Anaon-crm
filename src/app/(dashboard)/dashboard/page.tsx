export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getLeadStats } from '@/lib/leads/queries'
import { getBookingStats, getPendingApprovals } from '@/lib/bookings/queries'
import { getLoanStats } from '@/lib/loans/queries'
import {
  Users, Flame, Clock, CalendarCheck,
  Building2, CheckCircle2, AlertTriangle, CreditCard,
  BarChart2, Megaphone, UserCheck, Briefcase,
  Scale, Bot, Globe, MessageCircle,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, StatCard } from '@/components/ui/Card'
import PageHeader from '@/components/ui/PageHeader'
import StatusBadge from '@/components/ui/StatusBadge'
import { BOOKING_STATUS_CONFIG } from '@/types/bookings'
import type { BookingFull } from '@/types/bookings'

const MODULES = [
  { href: '/leads',        label: 'Leads',        icon: Users,        color: 'text-indigo-600', bg: 'bg-indigo-50'  },
  { href: '/clients',      label: 'Clients',      icon: UserCheck,    color: 'text-blue-600',   bg: 'bg-blue-50'    },
  { href: '/bookings',     label: 'Bookings',     icon: Building2,    color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { href: '/inventory',    label: 'Inventory',    icon: Building2,    color: 'text-cyan-600',   bg: 'bg-cyan-50'    },
  { href: '/loans',        label: 'Loans',        icon: CreditCard,   color: 'text-violet-600', bg: 'bg-violet-50'  },
  { href: '/marketing',    label: 'Marketing',    icon: Megaphone,    color: 'text-pink-600',   bg: 'bg-pink-50'    },
  { href: '/reports',      label: 'Reports',      icon: BarChart2,    color: 'text-amber-600',  bg: 'bg-amber-50'   },
  { href: '/hr',           label: 'HR',           icon: Briefcase,    color: 'text-rose-600',   bg: 'bg-rose-50'    },
  { href: '/legal',        label: 'Legal',        icon: Scale,        color: 'text-slate-600',  bg: 'bg-slate-100'  },
  { href: '/automation',   label: 'Automation',   icon: Bot,          color: 'text-teal-600',   bg: 'bg-teal-50'    },
  { href: '/whatsapp',     label: 'WhatsApp',     icon: MessageCircle,color: 'text-emerald-600', bg: 'bg-emerald-50'},
  { href: '/website',      label: 'Website',      icon: Globe,        color: 'text-sky-600',    bg: 'bg-sky-50'     },
]

export default async function DashboardHome() {
  const profileData = await getProfile()
  if (!profileData || !profileData.user) redirect('/login')
  const { user, profile } = profileData

  const role = profile?.role ?? 'sales_advisor'
  const branchId = profile?.branch_id ?? undefined

  const [leadStats, bookingStats, loanStats, pendingApprovals] = await Promise.all([
    getLeadStats(user.id, role, branchId),
    getBookingStats(),
    getLoanStats(),
    getPendingApprovals(),
  ])

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  const isManager = ['admin', 'manager'].includes(role)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={`Good morning, ${firstName}`}
        subtitle={today}
      />

      {/* Lead stats */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Leads</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Leads"
            value={leadStats.total}
            sub={`${leadStats.newToday} added today`}
            icon={<Users size={20} className="text-indigo-600" />}
            iconBg="bg-indigo-50"
            accent="border-indigo-500"
            href="/leads"
          />
          <StatCard
            label="Hot Leads"
            value={leadStats.hot}
            sub="Score 80+"
            icon={<Flame size={20} className="text-red-600" />}
            iconBg="bg-red-50"
            accent="border-red-500"
            href="/leads?temperature=hot"
          />
          <StatCard
            label="Overdue Follow-ups"
            value={leadStats.overdue}
            sub="Needs immediate action"
            icon={<Clock size={20} className="text-amber-600" />}
            iconBg="bg-amber-50"
            accent={leadStats.overdue > 0 ? 'border-amber-500' : 'border-slate-200'}
            href="/leads"
          />
          <StatCard
            label="Today's Follow-ups"
            value={leadStats.todayFollowups}
            sub="Scheduled for today"
            icon={<CalendarCheck size={20} className="text-emerald-600" />}
            iconBg="bg-emerald-50"
            accent="border-emerald-500"
            href="/leads"
          />
        </div>
      </div>

      {/* Booking + Loan stats — managers only */}
      {isManager && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Sales & Finance</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Bookings"
              value={bookingStats.total}
              sub={`${bookingStats.confirmed} confirmed`}
              icon={<Building2 size={20} className="text-emerald-600" />}
              iconBg="bg-emerald-50"
              accent="border-emerald-500"
              href="/bookings"
            />
            <StatCard
              label="Confirmed Value"
              value={formatCurrency(bookingStats.total_value)}
              sub="All confirmed bookings"
              icon={<CheckCircle2 size={20} className="text-blue-600" />}
              iconBg="bg-blue-50"
              accent="border-blue-500"
              href="/bookings"
            />
            <StatCard
              label="Pending Approval"
              value={bookingStats.pending_approval}
              sub="Awaiting review"
              icon={<AlertTriangle size={20} className="text-amber-600" />}
              iconBg="bg-amber-50"
              accent={bookingStats.pending_approval > 0 ? 'border-amber-500' : 'border-slate-200'}
              href="/bookings"
            />
            <StatCard
              label="Active Loan Apps"
              value={loanStats.activeApplications}
              sub={`${loanStats.activeBanks} banks · ${loanStats.activeDSAs} DSAs`}
              icon={<CreditCard size={20} className="text-violet-600" />}
              iconBg="bg-violet-50"
              accent="border-violet-500"
              href="/loans"
            />
          </div>
        </div>
      )}

      {/* Pending approvals alert */}
      {isManager && pendingApprovals.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500" />
            Pending Booking Approvals
          </h2>
          <div className="bg-white border border-amber-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-slate-100">
              {pendingApprovals.map((b: BookingFull) => (
                <Link key={b.id} href={`/bookings/${b.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {b.client?.full_name ?? '—'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {b.project?.name} · Plot {b.plot?.plot_number} · {formatCurrency(b.total_sale_value)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-slate-400">{formatDate(b.booking_date)}</span>
                    <StatusBadge config={BOOKING_STATUS_CONFIG['pending_approval']} size="sm" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Module grid */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Modules</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {MODULES.map(({ href, label, icon: Icon, color, bg }) => (
            <Link key={href} href={href}
              className="flex flex-col items-center gap-2 p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all text-center">
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
                <Icon size={20} className={color} />
              </div>
              <span className="text-xs font-medium text-slate-700">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
