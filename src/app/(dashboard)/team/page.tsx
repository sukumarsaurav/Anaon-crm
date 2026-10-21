import { Target, CalendarDays, Plus } from 'lucide-react'
import { getProfile } from '@/lib/supabase/getProfile'
import { getTeamPerformanceSummary, getAnnouncements } from '@/lib/team/queries'
import TeamOverviewStats from '@/components/team/TeamOverviewStats'
import MemberCard from '@/components/team/MemberCard'
import AnnouncementFeed from '@/components/team/AnnouncementFeed'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import Link from 'next/link'
import { istMonthYear } from '@/lib/datetime'

export const metadata = { title: 'Sales Team' }

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const profile = (await getProfile())?.profile

  const { month, year } = istMonthYear()

  const isManager = profile?.role === 'admin' || profile?.role === 'manager'

  const [summaries, announcements] = await Promise.all([
    // Who appears is decided by the team chain (RLS), not the viewer's branch.
    isManager ? getTeamPerformanceSummary(month, year) : Promise.resolve([]),
    getAnnouncements(profile?.branch_id ?? undefined),
  ])

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Sales Team"
        subtitle={`${new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })} performance`}
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

      {!isManager && profile && (
        <div className="flex flex-wrap gap-2">
          <Button href={`/team/${profile.id}`} variant="secondary" size="sm">My performance &amp; check-in</Button>
          <Button href="/team/attendance" variant="secondary" size="sm"><CalendarDays size={14} /> My attendance</Button>
        </div>
      )}

      {isManager && summaries.length === 0 && (
        <EmptyState title="No team members to show"
          description="The leaderboard lists the sales advisors and telecallers in the teams you lead. An admin can make you a team leader under Team → Teams." />
      )}

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
          <Link href="/team/announcements" className="text-sm text-primary-600 hover:underline">
            View all →
          </Link>
        </div>
        <AnnouncementFeed
          announcements={announcements.slice(0, 5)}
          canManage={isManager}
          viewerId={profile?.id}
          isAdmin={profile?.role === 'admin'}
        />
      </div>
    </div>
  )
}
