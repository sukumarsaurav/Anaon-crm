export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import TwoFactorSetup from '@/components/security/TwoFactorSetup'
import ActiveSessions from '@/components/security/ActiveSessions'
import { getActiveSessions } from '@/lib/security/actions'

export default async function SecuritySettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, two_factor_enabled, last_login_at, last_login_ip')
    .eq('id', user.id)
    .single()

  const { data: sessions } = await getActiveSessions()

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Security Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account security and active sessions</p>
      </div>

      {/* Last login info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm">
        <p className="font-medium text-slate-700 mb-2">Last Login</p>
        <div className="grid grid-cols-2 gap-2 text-slate-500">
          <span>Time:</span>
          <span className="text-slate-800 font-medium">
            {profile?.last_login_at
              ? new Date(profile.last_login_at).toLocaleString('en-IN')
              : 'Unknown'}
          </span>
          <span>IP Address:</span>
          <span className="text-slate-800 font-medium">{profile?.last_login_ip ?? '—'}</span>
          <span>Role:</span>
          <span className="text-slate-800 font-medium capitalize">{profile?.role?.replace('_', ' ') ?? '—'}</span>
        </div>
      </div>

      {/* 2FA setup (admin + manager only) */}
      {['admin', 'manager'].includes(profile?.role ?? '') && (
        <TwoFactorSetup
          enabled={profile?.two_factor_enabled ?? false}
          userId={user.id}
        />
      )}

      {/* Active sessions */}
      <ActiveSessions sessions={sessions ?? []} currentUserId={user.id} />
    </div>
  )
}
