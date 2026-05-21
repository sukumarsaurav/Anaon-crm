import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/layout/DashboardLayout'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, email')
    .eq('id', user.id)
    .single()

  // Brokers have their own portal
  if (profile?.role === 'broker') {
    redirect('/broker-portal')
  }

  const userInfo = profile
    ? { full_name: profile.full_name, role: profile.role, email: profile.email ?? user.email ?? '' }
    : { full_name: user.email ?? 'User', role: 'sales_advisor', email: user.email ?? '' }

  return <DashboardLayout user={userInfo}>{children}</DashboardLayout>
}
