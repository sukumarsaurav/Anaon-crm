'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare, Megaphone, FileText, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { label: 'Inbox',      href: '/whatsapp/inbox',      icon: MessageSquare },
  { label: 'Broadcasts', href: '/whatsapp/broadcasts',  icon: Megaphone },
  { label: 'Templates',  href: '/whatsapp/templates',   icon: FileText },
  { label: 'Auto-Reply', href: '/whatsapp/auto-reply',  icon: Settings },
]

export default function WhatsAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Tab bar */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 flex items-center gap-1">
        {tabs.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors',
                active
                  ? 'border-indigo-500 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              )}
            >
              <Icon size={14} />
              {label}
            </Link>
          )
        })}
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
