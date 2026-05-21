'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, CreditCard, FileText, Building2, MessageSquare, Phone, LogOut } from 'lucide-react'

const nav = [
  { label: 'Dashboard',    href: '/client-portal',              icon: LayoutDashboard },
  { label: 'Payments',     href: '/client-portal/payments',     icon: CreditCard      },
  { label: 'Documents',    href: '/client-portal/documents',    icon: FileText        },
  { label: 'Construction', href: '/client-portal/construction', icon: Building2       },
  { label: 'Complaints',   href: '/client-portal/complaints',   icon: MessageSquare   },
  { label: 'Support',      href: '/client-portal/support',      icon: Phone           },
]

interface Props {
  clientName: string
  projectName?: string | null
}

export default function ClientPortalNav({ clientName, projectName }: Props) {
  const pathname  = usePathname()
  const router    = useRouter()

  const handleSignOut = async () => {
    await fetch('/api/portal/logout', { method: 'POST' })
    router.push('/client-portal/login')
    router.refresh()
  }

  const isActive = (href: string) => {
    if (href === '/client-portal') return pathname === '/client-portal'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 z-30 h-screen w-60 bg-slate-900 flex-col">
        <div className="flex h-16 items-center gap-3 px-5 border-b border-slate-800">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Building2 size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">ANON INDIA</p>
            <p className="text-indigo-400 text-xs mt-0.5">Client Portal</p>
          </div>
        </div>
        <div className="px-5 py-4 border-b border-slate-800">
          <p className="text-white text-sm font-medium truncate">{clientName}</p>
          {projectName && <p className="text-slate-400 text-xs truncate mt-0.5">{projectName}</p>}
        </div>
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {nav.map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive(href) ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}>
              <Icon size={18} /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-800 py-3 px-2">
          <button onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800">
            <LogOut size={18} /><span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900 border-t border-slate-800 flex">
        {nav.map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
              isActive(href) ? 'text-indigo-400' : 'text-slate-500'
            )}>
            <Icon size={20} /><span>{label.split(' ')[0]}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
