export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/getProfile'
import { notFound } from 'next/navigation'
import { Shield, AlertTriangle, Globe, Users2, Lock } from 'lucide-react'
import IPWhitelistManager from '@/components/security/IPWhitelistManager'
import TeamSessionsManager from '@/components/security/TeamSessionsManager'
import SecuritySettingsForm from '@/components/security/SecuritySettingsForm'

export default async function AdminSecurityPage() {
  const supabase = await createClient()
  const user = (await getProfile())?.user
  if (!user) notFound()

  const profile = (await getProfile())?.profile
  if (!['admin', 'manager'].includes(profile?.role ?? '')) notFound()

  const [ipListRes, settingsRes, teamRes, recentFailedRes] = await Promise.all([
    supabase.from('ip_whitelist').select('*').order('created_at', { ascending: false }),
    supabase.from('security_settings').select('*').limit(1).maybeSingle(),
    supabase.from('profiles')
      .select('id, full_name, role, failed_login_count, lockout_until, last_login_at, two_factor_enabled, is_active')
      .in('role', ['admin', 'manager', 'sales_advisor', 'telecaller'])
      .eq('is_active', true)
      .order('full_name'),
    supabase.from('audit_logs')
      .select('id, action, created_at, ip_address, metadata, profiles:user_id(full_name)')
      .in('action', ['login_failed', 'login_locked', '2fa_failed'])
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const lockedUsers = (teamRes.data ?? []).filter(p =>
    p.lockout_until && new Date(p.lockout_until) > new Date()
  )

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Shield size={22} /> Security Administration
        </h1>
        <p className="text-sm text-slate-500 mt-1">Monitor threats, manage access, and configure security policies</p>
      </div>

      {/* Alert: locked accounts */}
      {lockedUsers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">
              {lockedUsers.length} account{lockedUsers.length > 1 ? 's' : ''} currently locked
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {lockedUsers.map(u => u.full_name).join(', ')} — due to failed login attempts
            </p>
          </div>
        </div>
      )}

      {/* Security settings */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Lock size={16} /> Security Policy
        </h2>
        <SecuritySettingsForm settings={settingsRes.data} />
      </div>

      {/* Team security status */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Users2 size={16} className="text-slate-400" />
          <h2 className="font-semibold text-slate-900">Team Security Status</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">2FA</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Failed Logins</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Last Login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(teamRes.data ?? []).map(p => {
                const isLocked = p.lockout_until && new Date(p.lockout_until) > new Date()
                const needs2FA = ['admin', 'manager'].includes(p.role) && !p.two_factor_enabled
                return (
                  <tr key={p.id} className={`hover:bg-slate-50 ${isLocked ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-3 font-medium text-slate-900">{p.full_name}</td>
                    <td className="px-4 py-3 text-slate-500 capitalize">{p.role?.replace('_', ' ')}</td>
                    <td className="px-4 py-3">
                      {p.two_factor_enabled
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">On</span>
                        : needs2FA
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Required</span>
                          : <span className="text-xs text-slate-400">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${p.failed_login_count > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {p.failed_login_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isLocked
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Locked</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Active</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {p.last_login_at ? new Date(p.last_login_at).toLocaleString('en-IN') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* IP Whitelist */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <Globe size={16} /> IP Whitelist
        </h2>
        <IPWhitelistManager
          entries={ipListRes.data ?? []}
          enabled={settingsRes.data?.ip_whitelist_enabled ?? false}
        />
      </div>

      {/* Recent failed logins */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Recent Security Events</h2>
        {(recentFailedRes.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">No recent security events.</p>
        ) : (
          <div className="space-y-2">
            {recentFailedRes.data?.map(log => {
              const action = log.action === 'login_locked' ? 'Account Locked'
                : log.action === 'login_failed' ? 'Failed Login'
                : '2FA Failed'
              return (
                <div key={log.id} className="flex items-center justify-between text-sm py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-700">{action}</span>
                    <span className="text-slate-500">{(log as any).profiles?.full_name ?? 'Unknown'}</span>
                    {log.ip_address && <span className="text-xs text-slate-400 font-mono">{String(log.ip_address)}</span>}
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(log.created_at).toLocaleString('en-IN')}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Force logout any user */}
      <TeamSessionsManager />
    </div>
  )
}
