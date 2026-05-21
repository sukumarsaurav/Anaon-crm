'use client'

import { Bell, Search, Menu } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'

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
        'fixed top-0 right-0 z-20 h-16 bg-white/95 backdrop-blur-sm',
        'border-b border-slate-200 shadow-sm',
        'flex items-center justify-between px-4 sm:px-5',
        'transition-all duration-300',
        // Mobile: always full-width (no sidebar offset)
        'left-0',
        // Desktop: offset by sidebar
        sidebarCollapsed ? 'lg:left-16' : 'lg:left-64',
      )}
    >
      {/* Left: hamburger (mobile only) + search */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Mobile hamburger */}
        <button
          onClick={onMobileMenuClick}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>

        {/* Search */}
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 hover:border-slate-300 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all w-full max-w-xs sm:max-w-sm">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search leads, clients..."
            className="bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none w-full min-w-0"
            aria-label="Global search"
          />
          <kbd className="hidden sm:inline-flex text-[10px] text-slate-400 font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded-md shrink-0">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: notifications + user */}
      <div className="flex items-center gap-2 ml-3 shrink-0">
        {/* Notifications */}
        <button
          className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"
            aria-hidden="true"
          />
        </button>

        {/* User avatar + info */}
        {user && (
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200 ml-1">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800 leading-none">{user.full_name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {roleLabel[user.role] ?? user.role}
              </p>
            </div>
            <div className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md shadow-indigo-200 shrink-0">
              {getInitials(user.full_name)}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
