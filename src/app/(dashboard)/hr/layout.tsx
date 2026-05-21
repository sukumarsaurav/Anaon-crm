'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Calendar, ClipboardList, IndianRupee, UserCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { label: 'Overview',    href: '/hr',               icon: LayoutDashboard },
  { label: 'Employees',   href: '/hr/employees',     icon: Users           },
  { label: 'Leaves',      href: '/hr/leaves',        icon: Calendar        },
  { label: 'Attendance',  href: '/hr/attendance',    icon: ClipboardList   },
  { label: 'Payroll',     href: '/hr/payroll',       icon: IndianRupee     },
  { label: 'Recruitment', href: '/hr/recruitment',   icon: UserCheck       },
]

export default function HRLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isTabActive = (href: string) => {
    if (href === '/hr') return pathname === '/hr'
    return pathname.startsWith(href)
  }

  return (
    <div>
      <div className="bg-white border-b border-slate-200 px-4 flex items-center gap-1 overflow-x-auto">
        {tabs.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              isTabActive(href)
                ? 'border-indigo-500 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            )}
          >
            <Icon size={14} />
            {label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  )
}
