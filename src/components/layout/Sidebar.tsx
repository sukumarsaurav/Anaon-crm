'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn, getInitials } from '@/lib/utils'
import {
  Users, Building2, LayoutDashboard, MessageSquare,
  UserCheck, UsersRound, BarChart3, Settings, ChevronLeft,
  Zap, Briefcase, LogOut, BookOpen, Handshake,
  HardHat, Megaphone, Scale, CreditCard,
  Smartphone, ShieldCheck, ClipboardList, X, Images, ChevronDown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from './ProfileProvider'
import { useNavBadges } from './useNavBadges'

type Role = 'admin' | 'manager' | 'sales_advisor' | 'telecaller'
const MANAGERS: Role[] = ['admin', 'manager']

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  /** Roles that see this item. Omit for everyone. UI only: the server still enforces access. */
  roles?: Role[]
  badge?: 'whatsappUnread' | 'overdueLeads'
}
interface NavGroup { label: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: 'Core CRM',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Leads', href: '/leads', icon: Users, badge: 'overdueLeads' },
      { label: 'Clients', href: '/clients', icon: UserCheck },
      { label: 'Bookings', href: '/bookings', icon: BookOpen },
    ],
  },
  {
    label: 'Property',
    items: [
      { label: 'Inventory', href: '/inventory', icon: Building2 },
      { label: 'Albums', href: '/albums', icon: Images },
      { label: 'Construction', href: '/construction', icon: HardHat },
      { label: 'Brokers', href: '/brokers', icon: Handshake, roles: MANAGERS },
    ],
  },
  {
    label: 'Engage',
    items: [
      { label: 'WhatsApp', href: '/whatsapp/inbox', icon: MessageSquare, badge: 'whatsappUnread' },
      { label: 'Marketing', href: '/marketing', icon: Megaphone, roles: MANAGERS },
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
      { label: 'HR', href: '/hr', icon: Briefcase, roles: MANAGERS },
      { label: 'Automation', href: '/automation', icon: Zap, roles: MANAGERS },
      { label: 'Legal', href: '/legal', icon: Scale, roles: MANAGERS },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'Mobile', href: '/mobile', icon: Smartphone, roles: MANAGERS },
      { label: 'Security', href: '/admin/security', icon: ShieldCheck, roles: MANAGERS },
      { label: 'Audit Log', href: '/audit-logs', icon: ClipboardList, roles: MANAGERS },
    ],
  },
]

const STORAGE_KEY = 'anon-sidebar-groups'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const profile = useProfile()
  const supabase = useMemo(() => createClient(), [])
  const badges = useNavBadges()

  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(profile.role as Role)) }))
        .filter((g) => g.items.length > 0),
    [profile.role],
  )

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onMobileClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen, onMobileClose])

  // Per-group collapse state, persisted to localStorage.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      setOpenGroups(raw ? JSON.parse(raw) : {})
    } catch {
      setOpenGroups({})
    }
  }, [])

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [label]: prev[label] === false ? true : false }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore quota / privacy-mode errors */
      }
      return next
    })
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    // After logging out of the CRM, land on the public real-estate website.
    window.location.href = process.env.NEXT_PUBLIC_WEBSITE_URL ?? 'https://anonindia.com'
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        'fixed left-0 top-0 z-30 h-screen flex flex-col',
        'bg-white border-r border-slate-200',
        'transition-all duration-300 ease-in-out',
        'w-64',
        collapsed ? 'lg:w-16' : 'lg:w-64',
        mobileOpen ? 'translate-x-0' : 'max-lg:-translate-x-full',
      )}
    >
      {/* Logo + collapse controls */}
      <div className="flex h-16 items-center justify-between px-3 border-b border-slate-200 shrink-0">
        <div
          className={cn(
            'flex items-center gap-2.5 overflow-hidden transition-all duration-300',
            collapsed ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100',
          )}
        >
          <div className="size-10 bg-primary rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-primary/30">
            <Building2 size={18} className="text-white" />
          </div>
          <div className="shrink-0">
            <p className="text-slate-900 font-bold text-sm leading-none tracking-wide">ANON INDIA</p>
            <p className="text-slate-500 text-xs mt-1 font-medium">Admin Dashboard</p>
          </div>
        </div>

        {collapsed && (
          <div className="hidden lg:flex size-10 bg-primary rounded-xl items-center justify-center mx-auto shadow-lg shadow-primary/30">
            <Building2 size={18} className="text-white" />
          </div>
        )}

        <button
          onClick={onMobileClose}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-ring"
          aria-label="Close navigation"
        >
          <X size={16} />
        </button>

        <button
          onClick={onToggle}
          className={cn(
            'hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-ring',
            collapsed && 'mx-auto',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft size={15} className={cn('transition-transform duration-300', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {visibleGroups.map((group) => {
          const expanded = openGroups[group.label] !== false
          return (
            <div key={group.label}>
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={expanded}
                  className="w-full flex items-center justify-between px-3 mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors focus-ring rounded"
                >
                  {group.label}
                  <ChevronDown
                    size={13}
                    className={cn('transition-transform duration-200', !expanded && '-rotate-90')}
                  />
                </button>
              )}
              {(expanded || collapsed) && (
                <div className="space-y-0.5">
                  {group.items.map(({ label, href, icon: Icon, badge }) => {
                    const active = isActive(href)
                    const count = badge ? badges[badge] : 0
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={onMobileClose}
                        title={collapsed ? label : undefined}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative focus-ring',
                          active
                            ? 'bg-primary/10 text-primary'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                        )}
                      >
                        <Icon
                          size={18}
                          className={cn(
                            'shrink-0 transition-colors',
                            active ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600',
                          )}
                        />
                        <span className={cn('truncate transition-all duration-300', collapsed ? 'lg:hidden' : '')}>
                          {label}
                        </span>
                        {count > 0 && (
                          <span
                            className={cn(
                              'ml-auto min-w-5 h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center',
                              badge === 'overdueLeads' ? 'bg-red-100 text-red-700' : 'bg-primary text-white',
                              collapsed && 'lg:absolute lg:top-0.5 lg:right-0.5 lg:min-w-2 lg:h-2 lg:p-0 lg:text-[0px]',
                            )}
                            aria-label={badge === 'overdueLeads' ? `${count} overdue` : `${count} unread`}
                          >
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Profile card */}
      <div className="border-t border-slate-200 p-2 shrink-0 relative">
        {/* Drop-up menu */}
        {profileMenuOpen && (
          <>
            <div className="fixed inset-0 z-0" onClick={() => setProfileMenuOpen(false)} aria-hidden="true" />
            <div
              role="menu"
              className={cn(
                'absolute bottom-full left-2 right-2 mb-2 z-10 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden py-1',
                collapsed && 'lg:left-full lg:right-auto lg:ml-2 lg:bottom-2 lg:mb-0 lg:w-44',
              )}
            >
              <Link
                href="/settings"
                onClick={() => {
                  setProfileMenuOpen(false)
                  onMobileClose()
                }}
                className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors focus-ring"
              >
                <Settings size={16} className="text-slate-400" />
                Settings
              </Link>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors focus-ring"
              >
                <LogOut size={16} />
                Log Out
              </button>
            </div>
          </>
        )}

        <button
          onClick={() => setProfileMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={profileMenuOpen}
          title={collapsed ? `${profile.fullName} — account` : undefined}
          className={cn(
            'w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-100 transition-colors focus-ring',
            collapsed && 'lg:justify-center',
          )}
        >
          <div className="size-9 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
            {getInitials(profile.fullName)}
          </div>
          <div className={cn('min-w-0 flex-1 text-left', collapsed ? 'lg:hidden' : '')}>
            <p className="text-sm font-semibold text-slate-900 truncate leading-tight">{profile.fullName}</p>
            <p className="text-xs text-slate-500 truncate">{profile.email}</p>
          </div>
          <ChevronDown
            size={15}
            className={cn(
              'text-slate-400 shrink-0 transition-transform',
              collapsed ? 'lg:hidden' : '',
              profileMenuOpen && 'rotate-180',
            )}
          />
        </button>
      </div>
    </aside>
  )
}
