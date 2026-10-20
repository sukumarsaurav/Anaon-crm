'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from './ProfileProvider'

export interface NavBadges {
  /** Conversations with unread inbound messages. */
  whatsappUnread: number
  /** Leads whose follow-up is overdue (scoped to the user's role/branch by the RPC). */
  overdueLeads: number
}

const REFRESH_MS = 60_000
/** The overdue count comes from get_lead_stats, which aggregates every lead; it changes slowly. */
const STATS_REFRESH_MS = 5 * 60_000

/** Lightweight counts for the sidebar. Polls while the tab is visible; failures leave the last value. */
export function useNavBadges(): NavBadges {
  const { userId, role, branchId } = useProfile()
  const supabase = useMemo(() => createClient(), [])
  const [badges, setBadges] = useState<NavBadges>({ whatsappUnread: 0, overdueLeads: 0 })

  useEffect(() => {
    let cancelled = false
    let statsAt = 0

    const load = async () => {
      if (document.visibilityState === 'hidden') return
      // The full lead-stats RPC ran every minute in every open tab just for this one number.
      const wantStats = Date.now() - statsAt >= STATS_REFRESH_MS
      const [wa, stats] = await Promise.all([
        supabase
          .from('whatsapp_conversations')
          .select('id', { count: 'exact', head: true })
          .gt('unread_count', 0),
        wantStats
          ? supabase.rpc('get_lead_stats', { p_user_id: userId, p_role: role, p_branch_id: branchId ?? null })
          : null,
      ])
      if (cancelled) return
      if (stats && !stats.error) statsAt = Date.now()
      setBadges((prev) => ({
        whatsappUnread: wa.error ? prev.whatsappUnread : (wa.count ?? 0),
        overdueLeads: !stats || stats.error ? prev.overdueLeads : Number((stats.data as { overdue?: number } | null)?.overdue ?? 0),
      }))
    }

    // Realtime only needs the WhatsApp count, not the heavier lead-stats RPC.
    const loadWa = async () => {
      if (document.visibilityState === 'hidden') return
      const wa = await supabase
        .from('whatsapp_conversations')
        .select('id', { count: 'exact', head: true })
        .gt('unread_count', 0)
      if (cancelled || wa.error) return
      setBadges((prev) => ({ ...prev, whatsappUnread: wa.count ?? 0 }))
    }

    void load()
    const timer = setInterval(load, REFRESH_MS)
    // The poll stays as a safety net; a conversation change (new inbound message, a chat
    // read) refreshes the badge straight away. Debounced: a burst of updates is one query.
    let debounce: ReturnType<typeof setTimeout> | undefined
    const channel = supabase
      .channel('nav-badges-wa')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations' }, () => {
        clearTimeout(debounce)
        debounce = setTimeout(loadWa, 400)
      })
      .subscribe()
    document.addEventListener('visibilitychange', load)
    return () => {
      cancelled = true
      clearInterval(timer)
      clearTimeout(debounce)
      void supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', load)
    }
  }, [supabase, userId, role, branchId])

  return badges
}
