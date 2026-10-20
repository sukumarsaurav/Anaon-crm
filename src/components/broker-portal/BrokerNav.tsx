'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Users, DollarSign, Building2, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const nav = [
  { label: 'Dashboard',   href: '/broker-portal',             icon: LayoutDashboard },
  { label: 'My Leads',    href: '/broker-portal/leads',       icon: Users           },
  { label: 'Commission',  href: '/broker-portal/commissions', icon: DollarSign      },
  { label: 'Inventory',   href: '/broker-portal/inventory',   icon: Building2       },
]

interface Props {
  brokerName: string
  firmName?: string | null
}

export default function BrokerNav({ brokerName, firmName }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const isActive = (href: string) => {
    if (href === '/broker-portal') return pathname === '/broker-portal'
    return pathname.startsWith(href)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
    {/* Phones: compact top bar + bottom tabs. The fixed sidebar left channel partners, who mostly
        work from a phone, about 135px of screen for the actual page. */}
    <header className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-slate-900 flex items-center justify-between px-4">
      <div className="min-w-0">
        <p className="text-white font-bold text-sm leading-none truncate">{brokerName}</p>
        <p className="text-primary-400 text-xs mt-0.5 truncate">{firmName || 'Partner Portal'}</p>
      </div>
      <button onClick={handleSignOut} aria-label="Sign out"
        className="p-2 -mr-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 focus-ring">
        <LogOut size={18} />
      </button>
    </header>
    <nav aria-label="Partner portal" className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900 border-t border-slate-800 flex pb-[env(safe-area-inset-bottom)]">
      {nav.map(({ label, href, icon: Icon }) => (
        <Link key={href} href={href} aria-current={isActive(href) ? 'page' : undefined}
          className={cn(
            'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
            isActive(href) ? 'text-primary-400' : 'text-slate-500'
          )}>
          <Icon size={20} /><span>{label.replace('My ', '')}</span>
        </Link>
      ))}
    </nav>

    <aside className="hidden md:flex fixed left-0 top-0 z-30 h-screen w-60 bg-slate-900 flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-slate-800">
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
          <Building2 size={18} className="text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-none">ANON INDIA</p>
          <p className="text-primary-400 text-xs mt-0.5">Partner Portal</p>
        </div>
      </div>

      {/* Broker info */}
      <div className="px-5 py-4 border-b border-slate-800">
        <p className="text-white text-sm font-medium truncate">{brokerName}</p>
        {firmName && <p className="text-slate-400 text-xs truncate mt-0.5">{firmName}</p>}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {nav.map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              isActive(href) ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}>
            <Icon size={18} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* Sign out */}
      <div className="border-t border-slate-800 py-3 px-2">
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800">
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
    </>
  )
}
