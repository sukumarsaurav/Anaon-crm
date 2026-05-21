'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Target, CalendarDays, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { label: 'Overview',      href: '/team',               icon: Users       },
  { label: 'Targets',       href: '/team/targets',        icon: Target      },
  { label: 'Attendance',    href: '/team/attendance',     icon: CalendarDays },
  { label: 'Announcements', href: '/team/announcements',  icon: Megaphone   },
]

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isTabActive = (href: string) => {
    if (href === '/team') return pathname === '/team'
    return pathname.startsWith(href)
  }

  return (
    <div>
      <div className="bg-white border-b border-slate-200 px-4 flex items-center gap-1">
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
