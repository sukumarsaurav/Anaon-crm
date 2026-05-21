'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Users, Building2, LayoutDashboard, MessageSquare,
  UserCheck, UsersRound, BarChart3, Settings, ChevronLeft,
  Zap, FileText, Briefcase, LogOut, BookOpen, Handshake,
  HardHat, Globe, PenLine, Megaphone, Scale, CreditCard,
  Smartphone, ShieldCheck, ClipboardList, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navGroups = [
  {
    label: 'Core CRM',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
      { label: 'Leads', href: '/leads', icon: Users },
      { label: 'Clients', href: '/clients', icon: UserCheck },
      { label: 'Bookings', href: '/bookings', icon: BookOpen },
    ],
  },
  {
    label: 'Property',
    items: [
      { label: 'Inventory', href: '/inventory', icon: Building2 },
      { label: 'Construction', href: '/construction', icon: HardHat },
      { label: 'Brokers', href: '/brokers', icon: Handshake },
    ],
  },
  {
    label: 'Engage',
    items: [
      { label: 'WhatsApp', href: '/whatsapp/inbox', icon: MessageSquare },
      { label: 'Marketing', href: '/marketing', icon: Megaphone },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Loans', href: '/loans', icon: CreditCard },
      { label: 'Reports', href: '/reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Team', href: '/team', icon: UsersRound },
      { label: 'HR', href: '/hr', icon: Briefcase },
      { label: 'Automation', href: '/automation', icon: Zap },
      { label: 'Legal', href: '/legal', icon: Scale },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'Blog', href: '/blog', icon: PenLine },
      { label: 'Website', href: '/website/careers', icon: Globe },
      { label: 'Mobile', href: '/mobile', icon: Smartphone },
      { label: 'Security', href: '/admin/security', icon: ShieldCheck },
      { label: 'Audit Log', href: '/audit-logs', icon: ClipboardList },
    ],
  },
]

const bottomNav = [
  { label: 'Settings', href: '/settings/security', icon: Settings },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <aside
      className={cn(
        // Base: fixed, full-height, dark background, flex column, smooth transition
        'fixed left-0 top-0 z-30 h-screen flex flex-col',
        'bg-slate-900 border-r border-slate-800/60',
        'transition-all duration-300 ease-in-out',
        // Always w-64 on mobile; desktop width controlled by collapsed state
        'w-64',
        collapsed ? 'lg:w-16' : 'lg:w-64',
        // Mobile: hide off-screen unless open. max-lg: avoids CSS conflict with desktop always-visible.
        mobileOpen ? 'translate-x-0' : 'max-lg:-translate-x-full',
      )}
    >
      {/* Logo + collapse controls */}
      <div className="flex h-16 items-center justify-between px-3 border-b border-slate-800/60 shrink-0">
        {/* Logo — hidden when desktop-collapsed but always shown on mobile */}
        <div className={cn(
          'flex items-center gap-2.5 overflow-hidden transition-all duration-300',
          collapsed ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100'
        )}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-indigo-900/40">
            <Building2 size={16} className="text-white" />
          </div>
          <div className="shrink-0">
            <p className="text-white font-bold text-sm leading-none tracking-wide">ANON INDIA</p>
            <p className="text-slate-500 text-[10px] mt-0.5 uppercase tracking-wider">CRM</p>
          </div>
        </div>

        {/* Collapsed-only logo */}
        {collapsed && (
          <div className="hidden lg:flex w-8 h-8 bg-indigo-600 rounded-lg items-center justify-center mx-auto shadow-lg shadow-indigo-900/40">
            <Building2 size={16} className="text-white" />
          </div>
        )}

        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Close navigation"
        >
          <X size={16} />
        </button>

        {/* Desktop collapse toggle */}
        <button
          onClick={onToggle}
          className={cn(
            'hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors',
            collapsed && 'mx-auto'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft
            size={15}
            className={cn('transition-transform duration-300', collapsed && 'rotate-180')}
          />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            {/* Section label — hidden when collapsed on desktop */}
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 lg:block">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ label, href, icon: Icon }) => {
                const active = isActive(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onMobileClose}
                    title={collapsed ? label : undefined}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group relative',
                      active
                        ? 'bg-indigo-600/20 text-indigo-300 ring-1 ring-indigo-500/30'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                    )}
                  >
                    <Icon
                      size={17}
                      className={cn(
                        'shrink-0 transition-colors',
                        active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'
                      )}
                    />
                    {/* Label — visible on mobile always; hidden on desktop when collapsed */}
                    <span className={cn(
                      'truncate transition-all duration-300',
                      collapsed ? 'lg:hidden' : ''
                    )}>
                      {label}
                    </span>

                    {/* Active indicator bar */}
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-r-full" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="border-t border-slate-800/60 pt-2 pb-3 px-2 space-y-0.5 shrink-0">
        {bottomNav.map(({ label, href, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-indigo-600/20 text-indigo-300'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              )}
            >
              <Icon size={17} className="shrink-0" />
              <span className={cn(collapsed ? 'lg:hidden' : '')}>{label}</span>
            </Link>
          )
        })}

        <button
          onClick={handleSignOut}
          title={collapsed ? 'Sign Out' : undefined}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
        >
          <LogOut size={17} className="shrink-0" />
          <span className={cn(collapsed ? 'lg:hidden' : '')}>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
