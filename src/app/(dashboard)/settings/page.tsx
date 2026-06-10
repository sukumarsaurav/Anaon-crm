export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ShieldCheck, Webhook, GitBranch, ChevronRight } from 'lucide-react'
import { getProfile } from '@/lib/supabase/getProfile'
import PageHeader from '@/components/ui/PageHeader'

interface SettingLink {
  href: string
  title: string
  description: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  adminOnly?: boolean
}

const LINKS: SettingLink[] = [
  {
    href: '/settings/security',
    title: 'Security',
    description: 'Two-factor authentication and active sessions',
    icon: ShieldCheck,
  },
  {
    href: '/settings/assignment',
    title: 'Lead Assignment Rules',
    description: 'Auto-route leads to reps by area, type, budget, or source',
    icon: GitBranch,
    adminOnly: true,
  },
  {
    href: '/settings/integrations',
    title: 'Lead Capture Integrations',
    description: 'Connect 99acres, JustDial, IndiaMart and more',
    icon: Webhook,
    adminOnly: true,
  },
]

export default async function SettingsPage() {
  const role = (await getProfile())?.profile?.role
  const isAdmin = role === 'admin'
  const links = LINKS.filter((l) => !l.adminOnly || isAdmin)

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Settings" subtitle="Manage your account and pipeline configuration" />
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <l.icon size={18} className="text-indigo-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{l.title}</p>
              <p className="text-sm text-slate-500 truncate">{l.description}</p>
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-500 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
