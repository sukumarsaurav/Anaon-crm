export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getHRStats } from '@/lib/hr/queries'
import {
  Users, UserCheck, Calendar, ClipboardList,
  IndianRupee, ArrowRight
} from 'lucide-react'

export default async function HRPage() {
  const stats = await getHRStats()

  const sections = [
    {
      title: 'Recruitment',
      href: '/hr/recruitment',
      icon: UserCheck,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      stat: stats.openPositions,
      statLabel: 'active candidates',
      description: 'Manage job applications pipeline, schedule interviews, make offers.',
    },
    {
      title: 'Employees',
      href: '/hr/employees',
      icon: Users,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      stat: stats.active,
      statLabel: 'active employees',
      description: 'View and update employee profiles, salary, bank details.',
    },
    {
      title: 'Leaves',
      href: '/hr/leaves',
      icon: Calendar,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      stat: stats.pending,
      statLabel: 'pending approvals',
      description: 'Review and approve or reject leave requests.',
    },
    {
      title: 'Attendance',
      href: '/hr/attendance',
      icon: ClipboardList,
      color: 'text-green-600',
      bg: 'bg-green-50',
      stat: stats.todayPresent,
      statLabel: "present today",
      description: "Today's check-ins, attendance logs and summaries.",
    },
    {
      title: 'Payroll',
      href: '/hr/payroll',
      icon: IndianRupee,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      stat: null,
      statLabel: '',
      description: 'Generate monthly payslips, adjust LOP, finalize payroll runs.',
    },
  ]

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">HR & Hiring</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {stats.active} employees · {stats.openPositions} candidates in pipeline · {stats.pending} leave requests pending
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map(({ title, href, icon: Icon, color, bg, stat, statLabel, description }) => (
          <Link key={href} href={href}
            className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-200 hover:shadow-sm transition-all group">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
                <Icon size={20} className={color} />
              </div>
              <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-400 transition-colors mt-1" />
            </div>
            <p className="font-semibold text-slate-900">{title}</p>
            {stat !== null && (
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {stat} <span className="text-sm font-normal text-slate-500">{statLabel}</span>
              </p>
            )}
            <p className="text-xs text-slate-500 mt-2">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
