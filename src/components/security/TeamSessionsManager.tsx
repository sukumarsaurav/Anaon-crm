'use client'

import { useState, useEffect } from 'react'
import { LogOut, RefreshCw } from 'lucide-react'
import { revokeSession, getActiveSessions } from '@/lib/security/actions'
import ActiveSessions from './ActiveSessions'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  id: string
  full_name: string
  role: string
}

export default function TeamSessionsManager() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('profiles')
      .select('id, full_name, role')
      .in('role', ['admin', 'manager', 'sales_advisor'])
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => setProfiles(data ?? []))
  }, [])

  async function loadSessions(userId: string) {
    setLoading(true)
    setSelected(userId)
    const { data } = await getActiveSessions(userId)
    setSessions(data ?? [])
    setLoading(false)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <LogOut size={16} /> Force Logout — User Sessions
      </h2>
      <div className="flex flex-wrap gap-2 mb-4">
        {profiles.map(p => (
          <button
            key={p.id}
            onClick={() => loadSessions(p.id)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              selected === p.id
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {p.full_name}
          </button>
        ))}
      </div>
      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <RefreshCw size={14} className="animate-spin" /> Loading sessions...
        </div>
      )}
      {selected && !loading && (
        <ActiveSessions
          sessions={sessions}
          currentUserId=""
          targetUserId={selected}
        />
      )}
    </div>
  )
}
