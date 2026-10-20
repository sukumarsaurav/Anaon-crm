import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/getProfile'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { ProfileProvider } from '@/components/layout/ProfileProvider'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getProfile()

  if (!session?.user) {
    redirect('/login')
  }

  const { user, profile } = session

  // A deactivated account used to keep working until its token expired. Data was already blocked by
  // the database policies, but every page still rendered.
  if (profile && profile.is_active === false) {
    redirect('/api/auth/signout?reason=deactivated')
  }

  // Brokers have their own portal
  if (profile?.role === 'broker') {
    redirect('/broker-portal')
  }

  const profileData = {
    userId: user.id,
    fullName: profile?.full_name ?? user.email ?? 'User',
    role: profile?.role ?? 'sales_advisor',
    email: profile?.email ?? user.email ?? '',
    branchId: profile?.branch_id ?? null,
  }

  return (
    <ProfileProvider profile={profileData}>
      <DashboardLayout user={{ full_name: profileData.fullName, role: profileData.role, email: profileData.email }}>
        {children}
      </DashboardLayout>
    </ProfileProvider>
  )
}
