import { getProfile } from '@/lib/supabase/getProfile'
import { getAnnouncements } from '@/lib/team/queries'
import AnnouncementFeed from '@/components/team/AnnouncementFeed'
import NewAnnouncementButton from '@/components/team/NewAnnouncementButton'

export const metadata = { title: 'Announcements' }

export const dynamic = 'force-dynamic'

export default async function AnnouncementsPage() {
  const session = await getProfile()
  const role = session?.profile?.role
  const isManager = role === 'admin' || role === 'manager'
  // Same audience rule as the Team overview: company-wide plus the viewer's branch.
  const announcements = await getAnnouncements(session?.profile?.branch_id ?? undefined)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
          <p className="text-sm text-slate-500 mt-1">Team-wide updates, shoutouts, and alerts</p>
        </div>
        {isManager && <NewAnnouncementButton />}
      </div>

      <AnnouncementFeed announcements={announcements} canManage={isManager}
        viewerId={session?.user?.id} isAdmin={role === 'admin'} />
    </div>
  )
}
