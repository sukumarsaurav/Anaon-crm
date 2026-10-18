import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'

export async function GET(req: NextRequest) {
  const auth = await getMobileUser(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user, profile, supabase } = auth
  const todayStr = new Date().toISOString().split('T')[0]

  const [followUps, overdueLeads, myLeads, myLeadsMonth, attendance, recentLeads] = await Promise.all([
    supabase.from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', user.id)
      .eq('is_active', true)
      .lte('next_followup_at', `${todayStr}T23:59:59`)
      .gte('next_followup_at', `${todayStr}T00:00:00`),

    supabase.from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', user.id)
      .eq('is_active', true)
      .lt('next_followup_at', `${todayStr}T00:00:00`)
      .not('stage', 'in', '(closed_won,not_interested)'),

    supabase.from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', user.id)
      .eq('is_active', true),

    supabase.from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', user.id)
      .eq('is_active', true)
      .gte('created_at', `${todayStr.slice(0, 7)}-01T00:00:00`),

    supabase.from('attendance')
      .select('id')
      .eq('user_id', user.id)
      .gte('check_in_time', `${todayStr}T00:00:00`)
      .limit(1),

    supabase.from('leads')
      .select('id, full_name, status:stage, created_at')
      .eq('assigned_to', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return NextResponse.json({
    profile: { full_name: profile.full_name, role: profile.role },
    todayFollowUps: followUps.count ?? 0,
    overdueLeads: overdueLeads.count ?? 0,
    myLeadsTotal: myLeads.count ?? 0,
    myLeadsThisMonth: myLeadsMonth.count ?? 0,
    todayCheckedIn: (attendance.data?.length ?? 0) > 0,
    recentLeads: recentLeads.data ?? [],
  })
}
