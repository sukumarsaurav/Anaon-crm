import { Target, CalendarDays, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getTeamPerformanceSummary, getAnnouncements } from '@/lib/team/queries'
import TeamOverviewStats from '@/components/team/TeamOverviewStats'
import MemberCard from '@/components/team/MemberCard'
import AnnouncementFeed from '@/components/team/AnnouncementFeed'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role, branch_id').eq('id', user!.id).single()

  const now = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()

  const isManager = profile?.role === 'admin' || profile?.role === 'manager'

  const [summaries, announcements] = await Promise.all([
    isManager ? getTeamPerformanceSummary(month, year, profile?.branch_id ?? undefined) : Promise.resolve([]),
    getAnnouncements(profile?.branch_id ?? undefined),
  ])

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Sales Team"
        subtitle={`${new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })} performance`}
        actions={isManager ? (
          <>
            <Button href="/team/targets" variant="secondary" size="sm">
              <Target size={14} /> Targets
            </Button>
            <Button href="/team/attendance" variant="secondary" size="sm">
              <CalendarDays size={14} /> Attendance
            </Button>
            <Button href="/team/announcements" variant="primary" size="sm">
              <Plus size={14} /> Announce
            </Button>
          </>
        ) : undefined}
      />

      {isManager && summaries.length > 0 && (
        <>
          <TeamOverviewStats summaries={summaries} />

          {/* Leaderboard */}
          <div>
            <h2 className="text-base font-semibold text-slate-800 mb-4">Team Leaderboard</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {summaries.map((summary, i) => (
                <MemberCard key={summary.member.id} summary={summary} rank={i + 1} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Announcements */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">Announcements</h2>
          <Link href="/team/announcements" className="text-sm text-indigo-600 hover:underline">
            View all →
          </Link>
        </div>
        <AnnouncementFeed
          announcements={announcements.slice(0, 5)}
          canManage={isManager}
        />
      </div>
    </div>
  )
}
