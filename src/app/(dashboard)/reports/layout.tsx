'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Users, TrendingUp, IndianRupee, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { label: 'Overview',   href: '/reports',            icon: BarChart3    },
  { label: 'Leads',      href: '/reports/leads',      icon: Users        },
  { label: 'Sales',      href: '/reports/sales',      icon: TrendingUp   },
  { label: 'Financial',  href: '/reports/financial',  icon: IndianRupee  },
  { label: 'Inventory',  href: '/reports/inventory',  icon: MapPin       },
]

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isTabActive = (href: string) => {
    if (href === '/reports') return pathname === '/reports'
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
