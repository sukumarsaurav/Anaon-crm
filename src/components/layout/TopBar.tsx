'use client'

import { Menu } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'
import CommandPalette from './CommandPalette'
import NotificationBell from './NotificationBell'
import PushRegistrar from './PushRegistrar'

interface TopBarProps {
  sidebarCollapsed: boolean
  user?: { full_name: string; role: string; email: string }
  onMobileMenuClick: () => void
}

const roleLabel: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  sales_advisor: 'Sales Advisor',
  telecaller: 'Telecaller',
}

export default function TopBar({ sidebarCollapsed, user, onMobileMenuClick }: TopBarProps) {
  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-20 h-16 bg-white/80 backdrop-blur-md',
        'border-b border-slate-200',
        'flex items-center justify-between px-4 sm:px-5',
        'transition-all duration-300',
        'left-0',
        sidebarCollapsed ? 'lg:left-16' : 'lg:left-64',
      )}
    >
      {/* Left: hamburger (mobile) + command palette */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={onMobileMenuClick}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0 focus-ring"
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>

        <CommandPalette />
      </div>

      {/* Right: notifications + user */}
      <div className="flex items-center gap-2 ml-3 shrink-0">
        <PushRegistrar />
        <NotificationBell />

        {user && (
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200 ml-1">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800 leading-none">{user.full_name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{roleLabel[user.role] ?? user.role}</p>
            </div>
            <div className="size-9 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md shadow-primary/30 shrink-0">
              {getInitials(user.full_name)}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
