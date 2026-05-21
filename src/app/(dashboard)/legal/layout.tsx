'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Scale, FileText, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { label: 'Overview',  href: '/legal',           icon: Scale    },
  { label: 'Documents', href: '/legal/documents', icon: FileText },
  { label: 'Privacy',   href: '/legal/privacy',   icon: Lock     },
]

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isTabActive = (href: string) => {
    if (href === '/legal') return pathname === '/legal' || pathname.match(/^\/legal\/[^/]+$/) !== null
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
